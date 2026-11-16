import "server-only";

/** Default model for all AI features; override with ANTHROPIC_MODEL. */
export const DEFAULT_AI_MODEL = "claude-opus-5-5";

export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
  },
  get anthropicApiKey(): string {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AI_MODEL;
  },
  /** Opt-in fast output mode (higher price) for supported models. */
  get anthropicFastMode(): boolean {
    return process.env.ANTHROPIC_FAST_MODE === "true";
  },
} as const;

export function isAiConfigured(): boolean {
  return serverEnv.anthropicApiKey.length > 0;
}

export function isServiceRoleConfigured(): boolean {
  return serverEnv.supabaseServiceRoleKey.length > 0;
}
