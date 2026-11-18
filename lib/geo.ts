import "server-only";

import { headers } from "next/headers";

/** Approximate visitor location, from the network address (no browser prompt). */
export interface ApproxLocation {
  city: string | null;
  region: string | null;
  country: string | null;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Strip control characters and collapse whitespace; names are short.
  const v = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return v && v.length <= 100 ? v : null;
}

/**
 * Parse Netlify's `x-nf-geo` request header (base64-encoded JSON with city,
 * subdivision and country). Returns null when absent or unreadable, e.g. in
 * local development. Coordinates are deliberately ignored.
 */
export function parseNetlifyGeo(raw: string | null | undefined): ApproxLocation | null {
  if (!raw || raw.length > 4096) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as { city?: unknown; subdivision?: { name?: unknown }; country?: { name?: unknown } };
  const location: ApproxLocation = {
    city: cleanName(d.city),
    region: cleanName(d.subdivision?.name),
    country: cleanName(d.country?.name),
  };
  return location.city || location.country ? location : null;
}

/** The current request's approximate location, if the host provides one. */
export async function getApproxLocation(): Promise<ApproxLocation | null> {
  const h = await headers();
  return parseNetlifyGeo(h.get("x-nf-geo"));
}
