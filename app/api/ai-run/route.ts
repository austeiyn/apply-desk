import { handleModelRun } from "@/lib/ai/model-runner";

/**
 * Local development and tests. On Netlify the edge function at the same path
 * (netlify/edge-functions/ai-run.ts) handles these requests instead, because
 * serverless functions there stop after about 30 seconds.
 */
export async function POST(request: Request) {
  return handleModelRun(request, { get: (name) => process.env[name] });
}
