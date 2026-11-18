import "server-only";

import type { z } from "zod";
import { AuthorizationError, requireActiveUserForAction, type SessionContext } from "@/lib/auth/session";
import { assertSameOrigin, jsonError, readAiRunId, streamJob } from "./stream";

/**
 * Standard wrapper for AI route handlers: CSRF origin check, active-user
 * authentication, request validation, then a streamed NDJSON job.
 */
export async function handleAiRoute<S extends z.ZodType>(
  request: Request,
  schema: S,
  work: (ctx: { session: SessionContext; body: z.infer<S>; progress: (message: string) => void }) => Promise<unknown>,
): Promise<Response> {
  let session: SessionContext;
  try {
    assertSameOrigin(request);
    session = await requireActiveUserForAction();
  } catch (e) {
    return jsonError(e instanceof AuthorizationError ? e.message : "Unauthorized", 401);
  }
  const raw: unknown = await request.json().catch(() => null);
  const aiRunId = readAiRunId(raw);
  if (raw && typeof raw === "object") delete (raw as { aiRunId?: unknown }).aiRunId;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid request.", 400);
  return streamJob((progress) => work({ session, body: parsed.data, progress }), { aiRunId });
}
