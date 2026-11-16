import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { AiError } from "./errors";
import { assertAiAllowed, recordAiUsage } from "./guard";
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
 * Run one structured-output request: quota/rate checks, the API call with a
 * Zod-validated JSON schema, refusal/truncation handling and usage metering.
 */
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>> {
  if (req.context.length + req.task.length > MAX_PROMPT_CHARS) throw new AiError("input_too_large");
  await assertAiAllowed(req.userId, { dedupeKey: req.dedupeKey });

  const model = serverEnv.anthropicModel;
  const started = Date.now();
  const anthropic = getAnthropic();

  try {
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: req.maxTokens ?? 16_000,
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: req.context, cache_control: { type: "ephemeral" } },
            { type: "text", text: req.task },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(req.schema), effort: req.effort ?? "medium" },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      ...(serverEnv.anthropicFastMode && FAST_MODE_MODELS.has(model) ? { speed: "fast" as const } : {}),
    });

    const usage = {
      inputTokens: (response.usage.input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens ?? 0,
    };
    const base = {
      userId: req.userId,
      feature: req.feature,
      model: response.model ?? model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      durationMs: Date.now() - started,
    };

    if (response.stop_reason === "refusal") {
      await recordAiUsage({ ...base, status: "refused", errorCode: response.stop_details?.category ?? "refusal" });
      throw new AiError("refused");
    }
    if (response.stop_reason === "max_tokens") {
      await recordAiUsage({ ...base, status: "error", errorCode: "max_tokens" });
      throw new AiError("truncated");
    }

    // parse() already validated against the schema; re-parse to apply
    // transforms/refinements the JSON schema can't express.
    const parsed = req.schema.safeParse(response.parsed_output);
    if (!parsed.success) {
      console.error(`[ai] ${req.feature} returned invalid output`, parsed.error.issues.slice(0, 5));
      await recordAiUsage({ ...base, status: "error", errorCode: "invalid_output" });
      throw new AiError("invalid_output");
    }

    await recordAiUsage({ ...base, status: "success" });
    return { data: parsed.data, model: base.model, usage };
  } catch (error) {
    if (error instanceof AiError) throw error;
    const mapped = mapApiError(error);
    await recordAiUsage({
      userId: req.userId,
      feature: req.feature,
      model,
      status: "error",
      errorCode: mapped.code,
      durationMs: Date.now() - started,
    });
    console.error(`[ai] ${req.feature} failed`, error instanceof Error ? `${error.name}: ${error.message}` : error);
    throw mapped;
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
