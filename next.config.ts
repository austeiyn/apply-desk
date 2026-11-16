import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const onNetlify = process.env.NETLIFY === "true";

// On Netlify the public site URL defaults to the site's own address
// (Netlify's URL variable) when NEXT_PUBLIC_APP_URL isn't set.
const netlifyAppUrl = !process.env.NEXT_PUBLIC_APP_URL && onNetlify ? process.env.URL : undefined;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || netlifyAppUrl || "";

// Supabase's public settings are compiled into the site, so a Netlify build
// without them can never work. Stop early with instructions instead of
// failing later with a stack trace.
if (onNetlify && !isDev) {
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `ApplyDesk build stopped: missing environment variable(s) ${missing.join(", ")}. ` +
        "Add them in Netlify under Project configuration > Environment variables (values from Supabase > Project Settings > API Keys), " +
        "then trigger a new deploy. See docs/DEPLOYMENT.md.",
    );
  }
}

// HTTPS-only directives apply when the public site is served over HTTPS
// (always true on Netlify); skipped for local http production runs.
const isHttps = appUrl.startsWith("https://");

function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const wss = url.protocol === "https:" ? `wss://${url.host}` : `ws://${url.host}`;
    return [url.origin, wss];
  } catch {
    return [];
  }
}

// Next.js injects inline bootstrap scripts, so 'unsafe-inline' is required for
// scripts without a nonce-based setup. All other sources are locked down.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}`.trim(),
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Every authenticated page is per-user and cookie-dependent, so Cache
  // Components/PPR offer little here; plain dynamic rendering keeps the
  // Netlify deployment simple and predictable.
  cacheComponents: false,
  ...(netlifyAppUrl ? { env: { NEXT_PUBLIC_APP_URL: netlifyAppUrl } } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  // PDF rendering reads embedded font files from disk at runtime.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./lib/documents/fonts/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
