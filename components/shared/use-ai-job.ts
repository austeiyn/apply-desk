"use client";

import { useCallback, useRef, useState } from "react";

type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "heartbeat" }
  | { type: "result"; data: unknown }
  | { type: "error"; error: string; code?: string }
  | { type: "defer"; runId: string; token: string }
  | { type: "done" };

export interface AiJobState {
  running: boolean;
  progress: string | null;
  error: string | null;
  errorCode: string | null;
}

type Outcome<T> = { ok: true; data: T } | { ok: false; error: string; code: string | null };

const DISCONNECTED = "The connection ended before the result arrived. Refresh to check whether it was saved.";

/** POST JSON and read an NDJSON stream; returns the last terminal event. */
async function readStream(url: string, body: unknown, onProgress: (message: string) => void): Promise<{ final: StreamEvent | null; failure?: Outcome<never> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    let message = "Request failed. Please try again.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* non-JSON */
    }
    return { final: null, failure: { ok: false, error: message, code: String(res.status) } };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: StreamEvent | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "progress") onProgress(event.message);
      else if (event.type !== "heartbeat") final = event;
    }
  }
  return { final };
}

/**
 * Call a streaming AI route (NDJSON) and resolve with the final result.
 * Exposes live progress text for loading states.
 *
 * When the route hands its model call to the edge runner (a "defer" event),
 * this waits for the runner at /api/ai-run and then repeats the route request
 * with the run id, which completes it. See lib/ai/model-runner.ts.
 */
export function useAiJob<T = unknown>(endpoint: string) {
  const [state, setState] = useState<AiJobState>({ running: false, progress: null, error: null, errorCode: null });
  const inFlight = useRef(false);

  const run = useCallback(
    async (body: unknown): Promise<Outcome<T>> => {
      if (inFlight.current) return { ok: false, error: "Already running.", code: "duplicate" };
      inFlight.current = true;
      setState({ running: true, progress: "Starting…", error: null, errorCode: null });
      const onProgress = (message: string) => setState((s) => ({ ...s, progress: message }));
      const finish = (outcome: Outcome<T>): Outcome<T> => {
        setState(outcome.ok ? { running: false, progress: null, error: null, errorCode: null } : { running: false, progress: null, error: outcome.error, errorCode: outcome.code });
        return outcome;
      };

      try {
        let payload = body;
        // A route makes at most a couple of model calls; the cap prevents loops.
        for (let step = 0; step < 4; step++) {
          const { final, failure } = await readStream(endpoint, payload, onProgress);
          if (failure) return finish(failure);
          if (final?.type === "result") return finish({ ok: true, data: final.data as T });
          if (final?.type === "error") return finish({ ok: false, error: final.error, code: final.code ?? null });
          if (final?.type !== "defer") return finish({ ok: false, error: DISCONNECTED, code: "disconnected" });

          // Wait for the model in the edge runner, then complete the request.
          const waited = await readStream("/api/ai-run", { runId: final.runId, token: final.token }, onProgress);
          if (waited.failure) return finish(waited.failure);
          if (waited.final?.type === "error") return finish({ ok: false, error: waited.final.error, code: "runner" });
          if (waited.final?.type !== "done") return finish({ ok: false, error: "The connection ended before the AI finished. Please try again.", code: "disconnected" });
          payload = { ...(body as Record<string, unknown>), aiRunId: final.runId };
          onProgress("Finishing…");
        }
        return finish({ ok: false, error: "Something went wrong while generating. Please try again.", code: "loop" });
      } catch {
        return finish({ ok: false, error: "Network error. Check your connection and try again.", code: "network" });
      } finally {
        inFlight.current = false;
      }
    },
    [endpoint],
  );

  return { ...state, run };
}
