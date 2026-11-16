import net from "node:net";

/**
 * Address ranges a server-side fetch must never reach (SSRF protection):
 * loopback, private, link-local (incl. cloud metadata 169.254.169.254),
 * carrier-grade NAT, documentation/benchmark, multicast and reserved space.
 */
const blockList = new net.BlockList();
// IPv4
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockList.addSubnet(addr, prefix, "ipv4");
}
// IPv6
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blockList.addSubnet(addr, prefix, "ipv6");
}

/** Extract an embedded IPv4 address from IPv4-mapped/compatible, NAT64 or 6to4 IPv6 forms. */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^(?:::ffff:|::ffff:0:|::|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (dotted) return dotted[1]!;
  // Expand to 8 hextets for hex-form checks.
  const expanded = expandIpv6(lower);
  if (!expanded) return null;
  const h = expanded.map((x) => parseInt(x, 16));
  const toV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  // ::ffff:a.b.c.d (hex) and ::a.b.c.d
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) return toV4(h[6]!, h[7]!);
  // 64:ff9b::/96 NAT64
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return toV4(h[6]!, h[7]!);
  // 2002::/16 6to4
  if (h[0] === 0x2002) return toV4(h[1]!, h[2]!);
  return null;
}

function expandIpv6(ip: string): string[] | null {
  if (!net.isIPv6(ip)) return null;
  let addr = ip;
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (v4) {
    const p = v4[1]!.split(".").map(Number);
    addr = addr.replace(v4[1]!, `${((p[0]! << 8) | p[1]!).toString(16)}:${((p[2]! << 8) | p[3]!).toString(16)}`);
  }
  const [head, tail] = addr.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  if (tail === undefined) return headParts.length === 8 ? headParts : null;
  const fill = new Array(8 - headParts.length - tailParts.length).fill("0");
  return [...headParts, ...fill, ...tailParts];
}

export function isBlockedIp(ip: string): boolean {
  const zoneless = ip.split("%")[0]!;
  if (net.isIPv4(zoneless)) return blockList.check(zoneless, "ipv4");
  if (net.isIPv6(zoneless)) {
    const v4 = embeddedIpv4(zoneless);
    if (v4 && net.isIPv4(v4) && blockList.check(v4, "ipv4")) return true;
    return blockList.check(zoneless, "ipv6");
  }
  return true; // Not an IP we understand: refuse.
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp"];

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const DEFAULT_PORTS = ["80", "443"];

/** Validate a user-supplied URL before any network activity. */
export function assertSafeUrl(raw: string, allowedPorts: string[] = DEFAULT_PORTS): URL {
  if (typeof raw !== "string" || raw.length > 2048) throw new UnsafeUrlError("That link is too long.");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("Enter a full link starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https links are supported.");
  if (url.username || url.password) throw new UnsafeUrlError("Links containing usernames or passwords aren't supported.");
  if (url.port && !allowedPorts.includes(url.port)) throw new UnsafeUrlError("Links to non-standard ports aren't supported.");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const bareHost = host.replace(/^\[|\]$/g, "");
  if (net.isIP(bareHost)) {
    if (isBlockedIp(bareHost)) throw new UnsafeUrlError("That address isn't publicly accessible.");
    return url;
  }
  if (!host.includes(".") || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That address isn't publicly accessible.");
  }
  return url;
}
