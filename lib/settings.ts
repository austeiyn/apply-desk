import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface PlatformSettings {
  registration_open: boolean;
  ai_enabled: boolean;
  ai_daily_request_limit: number;
  ai_monthly_request_limit: number;
  max_source_cvs: number;
  support_email: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  registration_open: true,
  ai_enabled: true,
  ai_daily_request_limit: 40,
  ai_monthly_request_limit: 400,
  max_source_cvs: 10,
  support_email: "",
};

export function coerceSettings(rows: Array<{ key: string; value: unknown }>): PlatformSettings {
  const out: PlatformSettings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    switch (key) {
      case "registration_open":
      case "ai_enabled":
        if (typeof value === "boolean") out[key] = value;
        break;
      case "ai_daily_request_limit":
      case "ai_monthly_request_limit":
      case "max_source_cvs":
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = Math.floor(value);
        break;
      case "support_email":
        if (typeof value === "string") out.support_email = value;
        break;
    }
  }
  return out;
}

/** Platform settings are publicly readable (RLS select for all). */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("platform_settings").select("key, value");
    if (error || !data) return DEFAULT_SETTINGS;
    return coerceSettings(data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
