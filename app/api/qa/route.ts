import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHtml, htmlToText } from "@/lib/fetch-html";
import { forcedToolCall, AnthropicUnavailable, enforceCopyRules } from "@/lib/anthropic";
import { resolveQaSpeaker, persistQaExchange } from "@/lib/data/qa";

/**
 * POST /api/qa — Pulse Point Q&A (Section 6, item 14): "answering as the
 * current slide's assigned speaker, grounded in the live site,
 * company-name-aware on the banned-word check." Forced tool call, never
 * free-text JSON (Section 3 / CLAUDE.md hard-won lesson 1).
 */

const ANSWER_QUESTION_TOOL = {
  name: "answer_question",
  description:
    "Answers a visitor's question about the company through the Pulse Point, in the voice of the assigned speaker, grounded only in the provided site content.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description:
          "2 to 4 sentences, first person, in the speaker's voice. Never use an em dash or en dash, use commas instead. If the grounding content doesn't cover the question, say so plainly rather than inventing an answer.",
      },
    },
    required: ["answer"],
  },
};

/**
 * Short-lived in-memory cache of a site's grounding text so a run of visitor
 * questions against the same experience doesn't refetch the live site on
 * every single message. Gravel-road performance note: per-process only, and
 * resets on redeploy — an acceptable tradeoff for a pilot's Pulse Point, not
 * a durable cache.
 */
const GROUNDING_TTL_MS = 10 * 60 * 1000;
const groundingCache = new Map<string, { text: string; at: number }>();

async function getGroundingText(sourceUrl: string): Promise<string> {
  const cached = groundingCache.get(sourceUrl);
  if (cached && Date.now() - cached.at < GROUNDING_TTL_MS) return cached.text;
  const url = /^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`;
  const html = await fetchHtml(url);
  const text = html ? htmlToText(html, 8000) : "";
  groundingCache.set(sourceUrl, { text, at: Date.now() });
  return text;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const sessionKey = typeof body?.sessionKey === "string" ? body.sessionKey : null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const speakerProfileId =
    typeof body?.speakerProfileId === "string" ? body.speakerProfileId : null;

  if (!experienceId || !question) {
    return NextResponse.json(
      { error: "experienceId and question are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      success: true,
      gravel: true,
      answer: "Pulse Point isn't connected yet, this experience has no live database connection configured.",
      reason: "SUPABASE_SERVICE_ROLE_KEY not configured",
    });
  }

  const { data: experience } = await admin
    .from("experiences")
    .select("*")
    .eq("id", experienceId)
    .maybeSingle();
  if (!experience) {
    return NextResponse.json({ error: "experience not found" }, { status: 404 });
  }

  const speaker = await resolveQaSpeaker(admin, experienceId, speakerProfileId);
  const companyName = experience.company_name ?? undefined;
  const grounding = await getGroundingText(experience.source_url);

  let answer: string;
  try {
    const result = await forcedToolCall<{ answer: string }>({
      system: `You are answering as ${speaker.name}${speaker.title ? `, ${speaker.title}` : ""}, speaking through the Pulse Point on ${experience.company_name ?? "this company"}'s Pulse experience. ${
        speaker.bio
          ? `About you, for grounding only, do not recite this verbatim: ${speaker.bio}`
          : "You have no personal biography, you are the neutral Pulse Narrator, a general guide for this experience, speak in first person plural (we) rather than claiming a personal history."
      } Answer only from the grounding content below, drawn from the company's own live website. If the answer isn't covered by the grounding content, say plainly that you don't have that on hand rather than inventing it. Keep it to 2 to 4 sentences, warm and direct, first person. No em dashes or en dashes anywhere, use commas instead. Never use the word AI in your answer, say Generate or Generate media instead, except when writing the company's own name exactly as it writes it.`,
      user: `Grounding content from ${experience.source_url}:\n${grounding || "(no content could be retrieved from the live site right now)"}\n\nVisitor question: ${question}`,
      tool: ANSWER_QUESTION_TOOL,
      maxTokens: 500,
    });
    answer = enforceCopyRules(result.answer, companyName);
  } catch (err) {
    const reason =
      err instanceof AnthropicUnavailable
        ? "ANTHROPIC_API_KEY not configured"
        : "Pulse Point could not generate an answer";
    return NextResponse.json({
      success: true,
      gravel: true,
      answer: "Pulse Point isn't connected yet, Generate isn't configured for this experience.",
      reason,
    });
  }

  await persistQaExchange(admin, {
    experienceId,
    sessionKey,
    speakerProfileId: speaker.profileId,
    question,
    answer,
  });

  return NextResponse.json({
    success: true,
    gravel: false,
    answer,
    speaker: { name: speaker.name, title: speaker.title },
  });
}
