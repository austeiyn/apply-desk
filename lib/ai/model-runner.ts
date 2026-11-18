/**
 * Runs one prepared Claude request from the `ai_runs` hand-off table.
 *
 * Why: Netlify serverless functions stop after about 30 seconds, but many
 * generations take longer. The app server prepares and authorises each
 * request (quota, prompt, schema) and stores it; the browser then calls this
 * runner, which claims the request with a one-time token, waits for Claude
 * while streaming heartbeats, and stores the raw reply. The app server then
 * validates and saves the result (lib/ai/client.ts).
 *
 * This file is shared by the Netlify edge function (netlify/edge-functions/
 * ai-run.ts, Deno) and a Node route used locally and in tests
 * (app/api/ai-run/route.ts). It must therefore use only web-standard APIs and
 * the Anthropic SDK: no Node built-ins, no path aliases, no other app modules.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface RunnerEnv {
  get(name: string): string | undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const hosts = [new URL(request.url).host, request.headers.get("x-forwarded-host"), request.headers.get("host")].filter(Boolean);
    return hosts.includes(originHost);
  } catch {
    return false;
  }
}

/** Map an SDK error to the code the app server turns into a user message. */
function errorCode(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return "upstream_rate_limited";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "not_configured";
  if (error instanceof Anthropic.NotFoundError) return "model_not_found";
  if (error instanceof Anthropic.BadRequestError) {
    const m = error.message.toLowerCase();
    return m.includes("too long") || m.includes("too many tokens") || m.includes("context") ? "input_too_large" : "bad_request";
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) return "upstream_unavailable";
  return "upstream_error";
}

export async function handleModelRun(request: Request, env: RunnerEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);

  const body = (await request.json().catch(() => null)) as { runId?: unknown; token?: unknown } | null;
  const runId = typeof body?.runId === "string" ? body.runId : "";
  const token = typeof body?.token === "string" ? body.token : "";
  if (!UUID.test(runId) || !TOKEN.test(token)) return json({ error: "Invalid request." }, 400);

  const supabaseUrl = (env.get("NEXT_PUBLIC_SUPABASE_URL") ?? env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY") ?? env.get("SUPABASE_SECRET_KEY") ?? "";
  const apiKey = env.get("ANTHROPIC_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !apiKey) return json({ error: "AI features aren't fully configured on this deployment." }, 503);

  const rest = (query: string, init: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/ai_runs?${query}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    });

  // Claim the run: only a pending, unexpired run whose token matches, once.
  const now = new Date().toISOString();
  const tokenHash = await sha256Hex(token);
  const claim = await rest(
    `id=eq.${runId}&token_hash=eq.${tokenHash}&status=eq.pending&expires_at=gt.${encodeURIComponent(now)}&select=id,request`,
    { method: "PATCH", body: JSON.stringify({ status: "running", started_at: now }) },
  );
  const claimed = claim.ok ? ((await claim.json()) as Array<{ id: string; request: Record<string, unknown> }>) : [];
  if (!claimed[0]) return json({ error: "This request has expired or was already used. Please try again." }, 404);
  const params = claimed[0].request;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      // Keeps the browser connection (and any proxy) from idling out.
      const heartbeat = setInterval(() => write({ type: "heartbeat" }), 4000);
      write({ type: "heartbeat" });

      let update: Record<string, unknown>;
      try {
        const anthropic = new Anthropic({ apiKey, baseURL: env.get("ANTHROPIC_BASE_URL") || undefined, maxRetries: 2, timeout: 10 * 60 * 1000 });
        const message = await anthropic.beta.messages.create(params as never);
        update = {
          status: "done",
          finished_at: new Date().toISOString(),
          response: {
            model: message.model,
            stop_reason: message.stop_reason,
            stop_details: (message as { stop_details?: unknown }).stop_details ?? null,
            usage: message.usage,
            content: message.content.filter((b) => b.type === "text").map((b) => ({ type: "text", text: (b as { text: string }).text })),
          },
        };
      } catch (error) {
        update = {
          status: "failed",
          finished_at: new Date().toISOString(),
          error_code: errorCode(error),
          error_message: (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 2000),
        };
      }

      const saved = await rest(`id=eq.${runId}`, { method: "PATCH", body: JSON.stringify(update) }).catch(() => null);
      write(saved?.ok ? { type: "done" } : { type: "error", error: "Couldn't save the AI result. Please try again." });
      clearInterval(heartbeat);
      open = false;
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
