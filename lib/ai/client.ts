import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { AiError } from "./errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAiAllowed, recordAiUsage, releaseAiDedupe } from "./guard";
import { SYSTEM_PROMPT } from "./prompts";

let client: Anthropic | null = null;

/** Single shared Anthropic client (server only). */
export function getAnthropic(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey;
  if (!apiKey) throw new AiError("not_configured");
  if (!client) {
    client = new Anthropic({
      apiKey,
      maxRetries: 2,
      // Per-attempt timeout. Long generations are kept alive by the streaming
      // route wrapper (lib/ai/stream.ts).
      timeout: 120_000,
    });
  }
  return client;
}

/** Models that support server-side refusal fallbacks ("default" routing). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1", "claude-sonnet-5-5"]);
const FAST_MODE_MODELS = new Set(["claude-opus-5-5"]);

export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<S extends z.ZodType> {
  /** Metering label, e.g. "resume.generate". */
  feature: string;
  userId: string;
  schema: S;
  /**
   * Shared, cacheable context (candidate profile, job advertisement). Placed
   * before the task so the same prefix can be reused across features.
   */
  context: string;
  /** Feature-specific instructions. */
  task: string;
  maxTokens?: number;
  effort?: Effort;
  /** Prevent the same request being started twice concurrently. */
  dedupeKey?: string;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

// Rough guard against oversized prompts (≈4 chars/token, well under 1M context).
const MAX_PROMPT_CHARS = 400_000;

/**
 * Per-request context set by the AI route wrapper (lib/ai/stream.ts).
 * `deferred`: hand the model call to the edge runner instead of waiting here
 * (serverless functions on Netlify stop after ~30 s). `runId`: a finished run
 * whose stored reply should be used for this request.
 */
export interface AiRunContext {
  deferred: boolean;
  runId?: string;
}
const runContext = new AsyncLocalStorage<AiRunContext>();

export function withAiRunContext<T>(ctx: AiRunContext, fn: () => Promise<T>): Promise<T> {
  return runContext.run(ctx, fn);
}

/** Thrown to hand a prepared request to the edge runner; not an error. */
export class DeferredAiRun extends Error {
  constructor(
    readonly runId: string,
    readonly token: string,
  ) {
    super("AI request handed to the edge runner");
    this.name = "DeferredAiRun";
  }
}

/** The parts of a Messages API reply this client reads. */
interface ModelReply {
  model?: string;
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  usage: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
  content: Array<{ type: string; text?: string }>;
}

function buildParams<S extends z.ZodType>(req: StructuredRequest<S>, model: string) {
  const format = betaZodOutputFormat(req.schema);
  return {
    model,
    max_tokens: req.maxTokens ?? 16_000,
    system: [{ type: "text" as const, text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: req.context, cache_control: { type: "ephemeral" as const } },
          { type: "text" as const, text: req.task },
        ],
      },
    ],
    // Only the JSON schema is sent; responses are validated with the Zod schema here.
    output_config: { format: { type: "json_schema" as const, schema: format.schema }, effort: req.effort ?? "medium" },
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    ...(serverEnv.anthropicFastMode && FAST_MODE_MODELS.has(model) ? { speed: "fast" as const } : {}),
  };
}

/**
 * Run one structured-output request: quota/rate checks, the API call with a
 * Zod-validated JSON schema, refusal/truncation handling and usage metering.
 *
 * Inside an AI route the call is deferred: the prepared request is stored and
 * DeferredAiRun is thrown; the browser has the edge runner call the model and
 * then repeats the route request, which arrives here with the finished run.
 */
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
  if (req.context.length + req.task.length > MAX_PROMPT_CHARS) throw new AiError("input_too_large");
  const model = serverEnv.anthropicModel;
  const params = buildParams(req, model);
  const ctx = runContext.getStore();
  if (ctx?.deferred) return runDeferred(req, params, ctx);

  const release = await assertAiAllowed(req.userId, { dedupeKey: req.dedupeKey });
  try {
    return await runInline(req, params);
  } finally {
    await release();
  }
}

async function runInline<S extends z.ZodType>(req: StructuredRequest<S>, params: ReturnType<typeof buildParams>): Promise<StructuredResult<z.infer<S>>> {
  const started = Date.now();
  const anthropic = getAnthropic();
  let response: ModelReply;
  try {
    // create() rather than parse(): parse() throws on non-JSON text before we
    // can inspect stop_reason, which would hide refusals and truncation.
    response = (await anthropic.beta.messages.create(params)) as unknown as ModelReply;
  } catch (error) {
    const mapped = mapApiError(error);
    await recordAiUsage({ userId: req.userId, feature: req.feature, model: params.model, status: "error", errorCode: mapped.code, durationMs: Date.now() - started });
    console.error(`[ai] ${req.feature} failed`, error instanceof Error ? `${error.name}: ${error.message}` : error);
    throw mapped;
  }
  return interpretReply(req, response, params.model, Date.now() - started);
}

/** Refusal/truncation handling, JSON parsing, schema validation and metering. */
async function interpretReply<S extends z.ZodType>(
  req: StructuredRequest<S>,
  response: ModelReply,
  requestedModel: string,
  durationMs: number,
): Promise<StructuredResult<z.infer<S>>> {
  const usage = {
    inputTokens: (response.usage.input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens ?? 0,
  };
  const base = {
    userId: req.userId,
    feature: req.feature,
    model: response.model ?? requestedModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    durationMs,
  };

  if (response.stop_reason === "refusal") {
    await recordAiUsage({ ...base, status: "refused", errorCode: response.stop_details?.category ?? "refusal" });
    throw new AiError("refused");
  }
  if (response.stop_reason === "max_tokens") {
    await recordAiUsage({ ...base, status: "error", errorCode: "max_tokens" });
    throw new AiError("truncated");
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    await recordAiUsage({ ...base, status: "error", errorCode: "invalid_json" });
    throw new AiError("invalid_output");
  }
  // Validate (including refinements the JSON schema can't express).
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) {
    console.error(`[ai] ${req.feature} returned invalid output`, parsed.error.issues.slice(0, 5));
    await recordAiUsage({ ...base, status: "error", errorCode: "invalid_output" });
    throw new AiError("invalid_output");
  }

  await recordAiUsage({ ...base, status: "success" });
  return { data: parsed.data, model: base.model, usage };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Error codes stored by the edge runner (lib/ai/model-runner.ts). */
function runnerError(code: string | null): AiError {
  switch (code) {
    case "upstream_rate_limited":
    case "upstream_unavailable":
    case "input_too_large":
      return new AiError(code);
    case "not_configured":
      return new AiError("not_configured", "The AI service rejected the server's API key. The administrator needs to check ANTHROPIC_API_KEY.");
    case "model_not_found":
      return new AiError("not_configured", "The configured AI model isn't available. Check ANTHROPIC_MODEL.");
    default:
      return new AiError("upstream_error");
  }
}

async function runDeferred<S extends z.ZodType>(
  req: StructuredRequest<S>,
  params: ReturnType<typeof buildParams>,
  ctx: AiRunContext,
): Promise<StructuredResult<z.infer<S>>> {
  const admin = createAdminClient();
  const requestHash = sha256(JSON.stringify(params));

  if (ctx.runId) {
    const { data: run } = await admin.from("ai_runs").select("*").eq("id", ctx.runId).eq("user_id", req.userId).maybeSingle();
    // A run for another call in the same request falls through to a new run.
    if (run && run.feature === req.feature) {
      try {
        // The reply refers to records by position, so it may only be used
        // for exactly the request it was generated from.
        if (run.request_hash !== requestHash) {
          throw new AiError("upstream_error", "Your information changed while this was being generated. Please try again.");
        }
        const durationMs = run.started_at && run.finished_at ? Date.parse(run.finished_at) - Date.parse(run.started_at) : null;
        if (run.status === "done" && run.response) {
          return await interpretReply(req, run.response as unknown as ModelReply, params.model, durationMs ?? 0);
        }
        if (run.status === "failed") {
          const mapped = runnerError(run.error_code);
          await recordAiUsage({ userId: req.userId, feature: req.feature, model: params.model, status: "error", errorCode: mapped.code, durationMs: durationMs ?? undefined });
          console.error(`[ai] ${req.feature} failed in the edge runner`, run.error_code, run.error_message);
          throw mapped;
        }
        throw new AiError("upstream_error", "The AI request didn't finish. Please try again.");
      } finally {
        await admin.from("ai_runs").delete().eq("id", run.id);
        await releaseAiDedupe(req.userId, req.dedupeKey);
      }
    }
  }

  // Checks run once, before any tokens are spent. The duplicate-request lock
  // stays held until the run is finished above (or expires).
  const release = await assertAiAllowed(req.userId, { dedupeKey: req.dedupeKey });
  try {
    // Housekeeping: drop abandoned runs (prompt data must not linger).
    await admin.from("ai_runs").delete().lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const token = randomBytes(32).toString("base64url");
    const { data, error } = await admin
      .from("ai_runs")
      .insert({ user_id: req.userId, feature: req.feature, request_hash: requestHash, request: params as never, token_hash: sha256(token) })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Could not store the AI request");
    throw new DeferredAiRun(data.id, token);
  } catch (error) {
    if (!(error instanceof DeferredAiRun)) await release();
    throw error;
  }
}

function mapApiError(error: unknown): AiError {
  // Most specific first (APIConnectionError is a subclass of APIError in the TS SDK).
  if (error instanceof Anthropic.RateLimitError) return new AiError("upstream_rate_limited", undefined, { cause: error });
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("not_configured", "The AI service rejected the server's API key. The administrator needs to check ANTHROPIC_API_KEY.", {
      cause: error,
    });
  }
  if (error instanceof Anthropic.BadRequestError) {
    const message = error.message.toLowerCase();
    if (message.includes("too long") || message.includes("too many tokens") || message.includes("context")) {
      return new AiError("input_too_large", undefined, { cause: error });
    }
    return new AiError("upstream_error", undefined, { cause: error });
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError("not_configured", "The configured AI model isn't available. Check ANTHROPIC_MODEL.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) return new AiError("upstream_unavailable", undefined, { cause: error });
  if (error instanceof Anthropic.InternalServerError) return new AiError("upstream_unavailable", undefined, { cause: error });
  if (error instanceof Anthropic.APIError) return new AiError("upstream_error", undefined, { cause: error });
  return new AiError("upstream_error", undefined, { cause: error });
}
