import "server-only";

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import { publicEnv } from "@/lib/env";
import { assertSafeUrl, isBlockedIp, UnsafeUrlError } from "./net-guard";

export type FetchFailureReason =
  | "invalid_url"
  | "blocked_address"
  | "timeout"
  | "too_large"
  | "not_html"
  | "http_error"
  | "access_denied"
  | "not_found"
  | "rate_limited"
  | "too_many_redirects"
  | "network";

export class JobFetchError extends Error {
  constructor(
    readonly reason: FetchFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "JobFetchError";
  }
}

export interface FetchedPage {
  url: string;
  html: string;
  status: number;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Dependency injection for tests only; production always uses the guarded DNS lookup. */
  lookup?: LookupFunction;
  isBlocked?: (ip: string) => boolean;
  allowedPorts?: string[];
}

/**
 * DNS lookup that refuses to resolve to non-public addresses. Used as the
 * socket's lookup function, so the validated address is the one connected to
 * (prevents DNS-rebinding between "check" and "use").
 */
function guardedLookup(isBlocked: (ip: string) => boolean, base: LookupFunction = dns.lookup as unknown as LookupFunction): LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    base(hostname, { ...options, all: true }, ((err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [];
      if (list.length === 0 || list.some((a) => isBlocked(a.address))) {
        return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }));
      }
      if (options.all) return callback(null, list);
      return callback(null, list[0]!.address, list[0]!.family);
    }) as never);
  }) as LookupFunction;
}

function requestOnce(url: URL, opts: Required<Pick<FetchOptions, "maxBytes">> & { lookup: LookupFunction; deadline: number }) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer | null }>((resolve, reject) => {
    const remaining = opts.deadline - Date.now();
    if (remaining <= 0) return reject(new JobFetchError("timeout", "The site took too long to respond."));

    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: opts.lookup,
        timeout: remaining,
        headers: {
          "User-Agent": `Mozilla/5.0 (compatible; ApplyDeskBot/1.0; +${publicEnv.appUrl})`,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en-NZ,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: null });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding.includes("br")) stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding.includes("gzip")) stream = res.pipe(zlib.createGunzip());
        else if (encoding.includes("deflate")) stream = res.pipe(zlib.createInflate());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          // Enforced on the decompressed size (defends against compression bombs).
          if (size > opts.maxBytes) {
            req.destroy();
            reject(new JobFetchError("too_large", "That page is too large to import."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", () => reject(new JobFetchError("network", "We couldn't read the page.")));
      },
    );
    req.on("timeout", () => req.destroy(new JobFetchError("timeout", "The site took too long to respond.")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof JobFetchError) return reject(err);
      if (err.code === "EBLOCKED") return reject(new JobFetchError("blocked_address", "That address isn't publicly accessible."));
      reject(new JobFetchError("network", "We couldn't connect to that website."));
    });
    req.end();
  });
}

function decode(body: Buffer, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Fetch a public job advertisement page with SSRF, size, time and redirect limits. */
export async function fetchJobPage(rawUrl: string, options: FetchOptions = {}): Promise<FetchedPage> {
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxBytes ?? 3 * 1024 * 1024;
  const deadline = Date.now() + (options.timeoutMs ?? 12_000);
  const lookup = guardedLookup(options.isBlocked ?? isBlockedIp, options.lookup);

  let current: URL;
  try {
    current = assertSafeUrl(rawUrl, options.allowedPorts);
  } catch (e) {
    throw new JobFetchError(e instanceof UnsafeUrlError && e.message.includes("publicly") ? "blocked_address" : "invalid_url", (e as Error).message);
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(current, { maxBytes, lookup, deadline });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.location;
      if (!location) throw new JobFetchError("http_error", "The site returned an invalid redirect.");
      let next: URL;
      try {
        next = assertSafeUrl(new URL(location, current).toString(), options.allowedPorts);
      } catch (e) {
        throw new JobFetchError("blocked_address", (e as Error).message);
      }
      current = next;
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new JobFetchError("access_denied", "This site requires signing in or blocks automated access.");
    }
    if (res.status === 404 || res.status === 410) throw new JobFetchError("not_found", "That job advertisement couldn't be found. It may have closed.");
    if (res.status === 429) throw new JobFetchError("rate_limited", "The job site is limiting requests right now.");
    if (res.status < 200 || res.status >= 300) throw new JobFetchError("http_error", `The job site responded with an error (${res.status}).`);

    const contentType = String(res.headers["content-type"] ?? "");
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new JobFetchError("not_html", "That link doesn't point to a web page we can read.");
    }
    return { url: current.toString(), html: decode(res.body ?? Buffer.alloc(0), contentType), status: res.status };
  }
  throw new JobFetchError("too_many_redirects", "That link redirects too many times.");
}
