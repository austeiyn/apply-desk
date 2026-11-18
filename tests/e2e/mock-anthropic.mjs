// A minimal stand-in for the Anthropic Messages API used by the E2E suite.
//
// The app's real SDK code path is exercised end to end: start the dev server
// with ANTHROPIC_BASE_URL=http://127.0.0.1:4010 and ANTHROPIC_API_KEY=test-key.
// The mock picks a canned structured response based on the JSON schema the
// app sends in output_config.format, and records every request so tests can
// assert on prompt construction (e.g. untrusted content is wrapped in tags).
import http from "node:http";
import { FIXTURES, pickFixture } from "./fixtures.mjs";

// Mirror the real API's structured-output complexity limits (per request: at
// most 16 properties with union types and 24 optional properties), so a schema
// the API would reject with "Schema is too complex for compilation" fails here.
function schemaComplexity(root) {
  const defs = root.$defs ?? root.definitions ?? {};
  const resolve = (n) => (typeof n?.$ref === "string" ? (defs[n.$ref.split("/").pop()] ?? n) : n);
  let optional = 0;
  let unions = 0;
  const seen = new Set();
  const walk = (raw) => {
    const node = resolve(raw);
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.type === "object" && node.properties) {
      const required = new Set(node.required ?? []);
      for (const [name, child] of Object.entries(node.properties)) {
        if (!required.has(name)) optional++;
        const c = resolve(child);
        if (Array.isArray(c.anyOf) || Array.isArray(c.type)) unions++;
        walk(child);
      }
    }
    if (node.items) walk(node.items);
    for (const key of ["anyOf", "allOf"]) for (const c of node[key] ?? []) walk(c);
  };
  walk(root);
  return { optional, unions };
}

export function startMockAnthropic({ port = 4010 } = {}) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/v1/messages") || req.method !== "POST") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "not found" } }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const json = JSON.parse(body);
    requests.push({ headers: req.headers, body: json });

    // The SDK may authenticate with x-api-key or an Authorization bearer header.
    const key = req.headers["x-api-key"] ?? req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
    if (key !== "test-key") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      return;
    }

    const schema = json.output_config?.format?.schema ?? {};
    const complexity = schemaComplexity(schema);
    if (complexity.unions > 16 || complexity.optional > 24) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Schema is too complex for compilation" } }));
      return;
    }
    const name = pickFixture(schema, json);
    const payload = typeof FIXTURES[name] === "function" ? FIXTURES[name](json) : FIXTURES[name];
    if (!payload) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: `mock has no fixture for ${name}` } }));
      return;
    }

    // Small delay so the UI's streaming progress state is exercised.
    await new Promise((r) => setTimeout(r, 300));
    res.writeHead(200, { "content-type": "application/json", "request-id": `req_mock_${requests.length}` });
    res.end(
      JSON.stringify({
        id: `msg_mock_${requests.length}`,
        type: "message",
        role: "assistant",
        model: json.model,
        content: [{ type: "text", text: JSON.stringify(payload) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 800, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    );
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, requests, close: () => new Promise((r) => server.close(r)) }));
  });
}

// Allow running standalone: node tests/e2e/mock-anthropic.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const { requests } = await startMockAnthropic();
  console.log("Mock Anthropic API listening on http://127.0.0.1:4010");
  setInterval(() => {}, 1 << 30);
  process.on("SIGINT", () => {
    console.log(`\nHandled ${requests.length} requests`);
    process.exit(0);
  });
}
