import "server-only";

import { isAiConfigured, isServiceRoleConfigured } from "@/lib/env.server";
import { rateLimit, releaseRateLimit } from "@/lib/rate-limit";
import { getPlatformSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiError } from "./errors";

export interface AiQuota {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

/** Count metered requests (successful or refused) for quota purposes. */
export async function getAiQuota(userId: string): Promise<AiQuota> {
  const settings = await getPlatformSettings();
  const admin = createAdminClient();
  const now = Date.now();
  const [day, month] = await Promise.all([
    admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "error")
      .gte("created_at", new Date(now - 86400_000).toISOString()),
    admin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "error")
      .gte("created_at", new Date(now - 30 * 86400_000).toISOString()),
  ]);
  return {
    dailyUsed: day.count ?? 0,
    dailyLimit: settings.ai_daily_request_limit,
    monthlyUsed: month.count ?? 0,
    monthlyLimit: settings.ai_monthly_request_limit,
  };
}

/**
 * Pre-flight checks before spending tokens. Throws AiError with a
 * user-facing message when the request must not proceed. Returns a release
 * function for the duplicate-request lock, which callers must invoke when
 * the request finishes (success or failure).
 */
export async function assertAiAllowed(userId: string, opts: { dedupeKey?: string } = {}): Promise<() => Promise<void>> {
  if (!isAiConfigured()) throw new AiError("not_configured");
  if (!isServiceRoleConfigured()) {
    throw new AiError("not_configured", "AI usage metering isn't configured. The administrator needs to set SUPABASE_SERVICE_ROLE_KEY.");
  }

  const settings = await getPlatformSettings();
  if (!settings.ai_enabled) throw new AiError("disabled");

  const quota = await getAiQuota(userId);
  if (quota.dailyLimit > 0 && quota.dailyUsed >= quota.dailyLimit) throw new AiError("quota_daily");
  if (quota.monthlyLimit > 0 && quota.monthlyUsed >= quota.monthlyLimit) throw new AiError("quota_monthly");
  if (!(await rateLimit(`ai-burst:${userId}`, 8, 60))) throw new AiError("rate_limited");

  // Lock taken last so a rejected request never holds it. The window (3 min)
  // only matters if the process dies before releasing it.
  if (opts.dedupeKey) {
    const key = `ai-dup:${userId}:${opts.dedupeKey}`;
    if (!(await rateLimit(key, 1, 180))) throw new AiError("duplicate");
    return () => releaseRateLimit(key);
  }
  return async () => {};
}

/** Release the duplicate-request lock taken by assertAiAllowed (deferred runs). */
export async function releaseAiDedupe(userId: string, dedupeKey: string | undefined): Promise<void> {
  if (dedupeKey) await releaseRateLimit(`ai-dup:${userId}:${dedupeKey}`);
}

export interface UsageRecord {
  userId: string;
  feature: string;
  model: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  status: "success" | "error" | "refused";
  errorCode?: string | null;
  durationMs?: number;
}

/** Metering is written with the service role so users can't forge or erase it. */
export async function recordAiUsage(rec: UsageRecord): Promise<void> {
  try {
    const { error } = await createAdminClient().from("ai_usage").insert({
      user_id: rec.userId,
      feature: rec.feature,
      model: rec.model,
      input_tokens: rec.inputTokens ?? 0,
      output_tokens: rec.outputTokens ?? 0,
      cache_read_tokens: rec.cacheReadTokens ?? 0,
      status: rec.status,
      error_code: rec.errorCode ?? null,
      duration_ms: rec.durationMs ?? null,
    });
    if (error) console.error("[ai] failed to record usage", error.message);
  } catch (e) {
    console.error("[ai] failed to record usage", e);
  }
}
