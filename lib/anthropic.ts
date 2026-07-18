/**
 * Thin wrapper over the Anthropic Messages API using plain fetch — no SDK
 * dependency, so this never touches package.json (edits there require
 * explicit sign-off per .claude/settings.json). Every call here forces a
 * tool call (Section 3: "forced tool calls, never free-text JSON"); the
 * caller supplies the one tool schema it wants and gets back the parsed
 * tool_use input directly.
 */

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export class AnthropicUnavailable extends Error {}

export async function forcedToolCall<T = Record<string, unknown>>(opts: {
  system: string;
  user: string;
  tool: AnthropicTool;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicUnavailable("ANTHROPIC_API_KEY not configured");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find(
    (block: { type: string }) => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Anthropic response had no tool_use block");
  return toolUse.input as T;
}

/**
 * Typography house rules (Section 2b), enforced at generation time on every
 * text field a forced tool call returns: no em or en dashes, and the banned
 * "AI" pattern with company-name masking (Section 2's exemption: a
 * company's own name, and its suffix-stripped variant, is masked out before
 * the check runs so e.g. "Forward Edge-AI" survives untouched).
 */
export function enforceCopyRules(text: string, companyName?: string): string {
  const checked = text.replace(/[–—]/g, ",");
  const stripped = companyName?.replace(/[-\s](AI|A\.I\.?)$/i, "").trim();
  const protectedNames = Array.from(
    new Set([companyName, stripped].filter((n): n is string => Boolean(n)))
  );
  if (protectedNames.length === 0) return checked.replace(/\bAI\b/g, "Generate");

  const escaped = protectedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  return checked
    .split(pattern)
    .map((part) => (protectedNames.includes(part) ? part : part.replace(/\bAI\b/gi, "Generate")))
    .join("");
}
