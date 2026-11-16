import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertSafeUrl, isBlockedIp, UnsafeUrlError } from "@/lib/jobs/net-guard";
import { fetchJobPage, JobFetchError } from "@/lib/jobs/fetch-page";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata endpoint
    "100.64.0.1", // carrier-grade NAT
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1", // IPv4-mapped
    "::ffff:7f00:1", // IPv4-mapped, hex form
    "::ffff:a9fe:a9fe", // mapped metadata IP
    "64:ff9b::a00:1", // NAT64 of 10.0.0.1
    "2002:7f00:1::", // 6to4 of 127.0.0.1
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "203.97.78.44", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows public %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("accepts public https job links", () => {
    expect(assertSafeUrl("https://www.seek.co.nz/job/12345678").hostname).toBe("www.seek.co.nz");
  });

  it.each([
    ["ftp://example.com/x", /http and https/],
    ["file:///etc/passwd", /http and https/],
    ["javascript:alert(1)", /http and https/],
    ["https://user:pass@example.com/", /usernames or passwords/],
    ["https://example.com:8080/", /non-standard ports/],
    ["http://localhost/admin", /publicly accessible/],
    ["http://intranet/", /publicly accessible/],
    ["http://printer.local/", /publicly accessible/],
    ["http://127.0.0.1/", /publicly accessible/],
    ["http://2130706433/", /publicly accessible/], // decimal 127.0.0.1
    ["http://0x7f000001/", /publicly accessible/], // hex 127.0.0.1
    ["http://017700000001/", /publicly accessible/], // octal 127.0.0.1
    ["http://[::1]/", /publicly accessible/],
    ["http://[::ffff:169.254.169.254]/", /publicly accessible/],
    ["http://169.254.169.254/latest/meta-data/", /publicly accessible/],
    ["not a url", /full link/],
  ])("rejects %s", (url, message) => {
    expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError);
    expect(() => assertSafeUrl(url)).toThrow(message);
  });
});

describe("fetchJobPage (network behaviour)", () => {
  let server: http.Server;
  let port: number;

  // Injected test DNS: "jobs.test" -> the local test server, "evil.test" -> a
  // private address that must be refused when the socket connects.
  const lookup = ((hostname: string, options: { all?: boolean }, cb: (...a: unknown[]) => void) => {
    const address = hostname === "evil.test" ? "10.0.0.7" : "127.0.0.1";
    if (options.all) cb(null, [{ address, family: 4 }]);
    else cb(null, address, 4);
  }) as never;
  // Only the loopback test server is treated as "public" in these tests.
  const isBlocked = (ip: string) => ip !== "127.0.0.1" && isBlockedIp(ip);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = new URL(req.url ?? "/", "http://x").pathname;
      const html = (body: string) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(body);
      };
      switch (path) {
        case "/job":
          return html("<html><body><h1>Developer</h1><p>Great job</p></body></html>");
        case "/redirect-ok":
          res.writeHead(302, { location: `http://jobs.test:${port}/job` });
          return res.end();
        case "/redirect-internal":
          res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
          return res.end();
        case "/redirect-rebind":
          res.writeHead(302, { location: `http://evil.test:${port}/` });
          return res.end();
        case "/loop":
          res.writeHead(302, { location: `http://jobs.test:${port}/loop` });
          return res.end();
        case "/login":
          res.writeHead(403);
          return res.end();
        case "/pdf":
          res.writeHead(200, { "content-type": "application/pdf" });
          return res.end("%PDF");
        case "/bomb":
          res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
          return res.end(zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024, 97)));
        case "/slow":
          setTimeout(() => html("<p>late</p>"), 2000);
          return;
        default:
          res.writeHead(404);
          return res.end();
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const fetchTest = (path: string, extra: { maxBytes?: number; timeoutMs?: number } = {}) =>
    fetchJobPage(`http://jobs.test:${port}${path}`, { lookup, isBlocked, allowedPorts: [String(port)], ...extra });

  it("rejects non-standard ports under the production policy", async () => {
    await expect(fetchJobPage(`http://jobs.test:${port}/job`, { lookup, isBlocked })).rejects.toMatchObject({ reason: "invalid_url" });
  });

  it("fetches HTML and follows safe redirects", async () => {
    const res = await fetchTest("/redirect-ok");
    expect(res.html).toContain("Great job");
    expect(res.url).toBe(`http://jobs.test:${port}/job`);
  });

  it("blocks redirects to internal addresses", async () => {
    await expect(fetchTest("/redirect-internal")).rejects.toMatchObject({ reason: "blocked_address" });
  });

  it("blocks hostnames that resolve to private IPs at connect time", async () => {
    await expect(fetchTest("/redirect-rebind")).rejects.toMatchObject({ reason: "blocked_address" });
  });

  it("stops redirect loops", async () => {
    await expect(fetchTest("/loop")).rejects.toMatchObject({ reason: "too_many_redirects" });
  });

  it("reports access restrictions instead of bypassing them", async () => {
    await expect(fetchTest("/login")).rejects.toMatchObject({ reason: "access_denied" });
  });

  it("rejects non-HTML responses", async () => {
    await expect(fetchTest("/pdf")).rejects.toMatchObject({ reason: "not_html" });
  });

  it("enforces the size limit on decompressed content (compression bomb)", async () => {
    await expect(fetchTest("/bomb", { maxBytes: 1024 * 1024 })).rejects.toMatchObject({ reason: "too_large" });
  });

  it("enforces the overall timeout", async () => {
    const err = await fetchTest("/slow", { timeoutMs: 400 }).catch((e) => e);
    expect(err).toBeInstanceOf(JobFetchError);
    expect(err.reason).toBe("timeout");
  });

  it("maps 404 to not_found", async () => {
    await expect(fetchTest("/missing")).rejects.toMatchObject({ reason: "not_found" });
  });
});
