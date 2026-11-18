import "server-only";

import { AuthorizationError } from "@/lib/auth/session";
import { DeferredAiRun, withAiRunContext } from "./client";
import { AiError } from "./errors";

export type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "heartbeat" }
  | { type: "result"; data: unknown }
  | { type: "error"; error: string; code?: string }
  /** The model call was handed to the edge runner; see useAiJob. */
  | { type: "defer"; runId: string; token: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read the optional `aiRunId` the browser sends when repeating a deferred request. */
export function readAiRunId(body: unknown): string | undefined {
  const id = body && typeof body === "object" ? (body as { aiRunId?: unknown }).aiRunId : undefined;
  return typeof id === "string" && UUID.test(id) ? id : undefined;
}

/**
 * Run a long AI job inside a streamed NDJSON response. Heartbeats keep the
 * connection alive through proxies while the model works, and progress
 * messages drive the UI. Errors are converted to user-safe messages.
 */
export function streamJob<T>(work: (progress: (message: string) => void) => Promise<T>, options: { aiRunId?: string } = {}): Response {
  // Model calls are handed to the edge runner (lib/ai/model-runner.ts) unless
  // AI_RUNNER=inline, e.g. on a host without a function time limit.
  const deferred = process.env.AI_RUNNER !== "inline";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => write({ type: "heartbeat" }), 4000);
      try {
        const data = await withAiRunContext({ deferred, runId: options.aiRunId }, () => work((message) => write({ type: "progress", message })));
        write({ type: "result", data });
      } catch (error) {
        if (error instanceof DeferredAiRun) {
          write({ type: "defer", runId: error.runId, token: error.token });
        } else if (error instanceof AiError) {
          write({ type: "error", error: error.userMessage, code: error.code });
        } else if (error instanceof AuthorizationError) {
          write({ type: "error", error: error.message, code: "unauthorized" });
        } else {
          console.error("[stream] unexpected error", error);
          write({ type: "error", error: "Something went wrong. Please try again.", code: "internal" });
        }
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * CSRF defence for JSON route handlers: require a same-origin request.
 * (Server Actions have this built in; route handlers do not.)
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) throw new AuthorizationError("Invalid request origin.");
  try {
    if (new URL(origin).host !== host) throw new Error();
  } catch {
    throw new AuthorizationError("Invalid request origin.");
  }
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
