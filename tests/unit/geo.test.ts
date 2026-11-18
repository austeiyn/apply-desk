import { describe, expect, it } from "vitest";
import { parseNetlifyGeo } from "@/lib/geo";

const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");

describe("parseNetlifyGeo", () => {
  it("reads city, region and country names", () => {
    const raw = encode({ city: "Auckland", subdivision: { code: "AUK", name: "Auckland" }, country: { code: "NZ", name: "New Zealand" }, latitude: -36.8, longitude: 174.7 });
    expect(parseNetlifyGeo(raw)).toEqual({ city: "Auckland", region: "Auckland", country: "New Zealand" });
  });

  it("returns null when the header is missing, malformed or empty", () => {
    expect(parseNetlifyGeo(null)).toBeNull();
    expect(parseNetlifyGeo("not base64 json")).toBeNull();
    expect(parseNetlifyGeo(encode({}))).toBeNull();
    expect(parseNetlifyGeo(encode("x"))).toBeNull();
  });

  it("drops non-string or oversized values and control characters", () => {
    const raw = encode({ city: 42, country: { name: "New\u0000 Zealand" }, subdivision: { name: "x".repeat(500) } });
    expect(parseNetlifyGeo(raw)).toEqual({ city: null, region: null, country: "New Zealand" });
  });
});
