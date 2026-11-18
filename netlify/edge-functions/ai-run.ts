// Netlify edge function: waits for Claude on behalf of the app server.
//
// Netlify serverless functions stop after ~30 s, while edge functions only
// need to start their response within ~40 s and may then keep streaming. The
// app server prepares each AI request and the browser hands it over here; see
// lib/ai/model-runner.ts. On Netlify this takes precedence over the Next.js
// route at the same path (app/api/ai-run/route.ts), which serves local
// development and tests.
import { handleModelRun } from "../../lib/ai/model-runner.ts";

declare const Netlify: { env: { get(name: string): string | undefined } };

export default (request: Request) => handleModelRun(request, { get: (name) => Netlify.env.get(name) });

export const config = { path: "/api/ai-run", method: "POST" };
