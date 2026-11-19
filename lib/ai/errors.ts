export type AiErrorCode =
  | "not_configured"
  | "disabled"
  | "quota_daily"
  | "quota_monthly"
  | "rate_limited"
  | "duplicate"
  | "refused"
  | "truncated"
  | "invalid_output"
  | "input_too_large"
  | "upstream_rate_limited"
  | "upstream_unavailable"
  | "upstream_error"
  | "out_of_credit"
  | "not_found"
  | "invalid_input";

const MESSAGES: Record<AiErrorCode, string> = {
  not_configured:
    "AI features aren't set up on this deployment yet. The platform administrator needs to add an ANTHROPIC_API_KEY.",
  disabled: "AI features are temporarily disabled by the platform administrator.",
  quota_daily: "You've reached today's AI usage limit. It resets on a rolling 24-hour basis.",
  quota_monthly: "You've reached this month's AI usage limit.",
  rate_limited: "You're making requests very quickly. Wait a moment and try again.",
  duplicate: "That request is already running. Give it a moment to finish.",
  refused: "The AI couldn't complete this request. Try rephrasing or removing unusual content from the job description.",
  truncated: "The response was too long to complete. Try shortening the job description or your profile text.",
  invalid_output: "The AI returned an unexpected response. Please try again.",
  input_too_large: "That content is too long to process. Shorten it and try again.",
  upstream_rate_limited: "The AI service is busy right now. Please try again in a minute.",
  upstream_unavailable: "The AI service is temporarily unavailable. Please try again shortly.",
  upstream_error: "Something went wrong while generating. Please try again.",
  out_of_credit: "AI features are paused because the platform's Claude API credit has run out. The administrator needs to add credit in the Claude Console.",
  not_found: "We couldn't find that item. It may have been deleted.",
  invalid_input: "Some required information is missing.",
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly userMessage: string;

  constructor(code: AiErrorCode, userMessage?: string, options?: { cause?: unknown }) {
    super(userMessage ?? MESSAGES[code], options);
    this.name = "AiError";
    this.code = code;
    this.userMessage = userMessage ?? MESSAGES[code];
  }
}

export function aiErrorMessage(code: AiErrorCode): string {
  return MESSAGES[code];
}
