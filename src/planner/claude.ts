import Anthropic from "@anthropic-ai/sdk";

export const PLANNER_MODEL = () => process.env.VF_PLANNER_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const PLANNER_EFFORT = () => (process.env.VF_PLANNER_EFFORT as Effort) || "high";

let client: Anthropic | null = null;
export function claude() {
  client ??= new Anthropic();
  return client;
}

export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function explainError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY is missing or invalid (set it in .env).";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API. Wait a minute and retry.";
  if (e instanceof Anthropic.BadRequestError) return `Claude API rejected the request: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
