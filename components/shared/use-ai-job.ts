"use client";

import { useCallback, useRef, useState } from "react";

type StreamEvent =
  | { type: "progress"; message: string }
  | { type: "heartbeat" }
  | { type: "result"; data: unknown }
  | { type: "error"; error: string; code?: string };

export interface AiJobState {
  running: boolean;
  progress: string | null;
  error: string | null;
  errorCode: string | null;
}

/**
 * Call a streaming AI route (NDJSON) and resolve with the final result.
 * Exposes live progress text for loading states.
 */
export function useAiJob<T = unknown>(endpoint: string) {
  const [state, setState] = useState<AiJobState>({ running: false, progress: null, error: null, errorCode: null });
  const inFlight = useRef(false);

  const run = useCallback(
    async (body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; code: string | null }> => {
      if (inFlight.current) return { ok: false, error: "Already running.", code: "duplicate" };
      inFlight.current = true;
      setState({ running: true, progress: "Starting…", error: null, errorCode: null });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          let message = "Request failed. Please try again.";
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) message = j.error;
          } catch {
            /* non-JSON */
          }
          setState({ running: false, progress: null, error: message, errorCode: String(res.status) });
          return { ok: false, error: message, code: String(res.status) };
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
            if (event.type === "progress") setState((s) => ({ ...s, progress: event.message }));
            if (event.type === "result" || event.type === "error") final = event;
          }
        }

        if (final?.type === "result") {
          setState({ running: false, progress: null, error: null, errorCode: null });
          return { ok: true, data: final.data as T };
        }
        const message =
          final?.type === "error" ? final.error : "The connection ended before the result arrived. Refresh to check whether it was saved.";
        const code = final?.type === "error" ? (final.code ?? null) : "disconnected";
        setState({ running: false, progress: null, error: message, errorCode: code });
        return { ok: false, error: message, code };
      } catch {
        const message = "Network error. Check your connection and try again.";
        setState({ running: false, progress: null, error: message, errorCode: "network" });
        return { ok: false, error: message, code: "network" };
      } finally {
        inFlight.current = false;
      }
    },
    [endpoint],
  );

  return { ...state, run };
}
