import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forcedToolCall, AnthropicUnavailable, enforceCopyRules } from "@/lib/anthropic";
import { fetchHtml, htmlToText } from "@/lib/fetch-html";
import { createTrainSession, defaultRating } from "@/lib/data/train-sessions";
import type { TrainSessionRating } from "@/types/database";

const INSIGHTS_TOOL = {
  name: "preinterview_insights",
  description:
    "Produces a spoken preliminary-insight paragraph reflecting on a trainee's self-ratings, plus exactly 4 open interview questions grounded in the company's real work.",
  input_schema: {
    type: "object",
    properties: {
      insight: {
        type: "string",
        description:
          "One short spoken paragraph (2-4 sentences) a narrator would say aloud, reflecting on the trainee's self-ratings before the interview begins. Warm, direct, no filler.",
      },
      questions: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string" },
        description: "Exactly 4 open-ended interview questions, grounded in the company's actual work, that probe the trainee's real understanding rather than just repeating the self-ratings.",
      },
    },
    required: ["insight", "questions"],
  },
};

type Body = { experienceId?: string; ratings?: Record<string, number>; traineeEmail?: string };

function genericInsight(): { insight: string; questions: string[] } {
  return {
    insight:
      "Thanks for rating yourself on each module. Before we dig into the training, I would like to talk through a few of these areas with you directly.",
    questions: [
      "Walk me through how you would explain what this company does to someone who has never heard of it.",
      "Tell me about a time you had to learn something unfamiliar quickly. What worked?",
      "Which of the modules you just rated do you feel least confident about, and why?",
      "What would you want your first week here to look like?",
    ],
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const traineeEmail = typeof body?.traineeEmail === "string" ? body.traineeEmail.trim() : "";
  const ratings = body?.ratings && typeof body.ratings === "object" ? body.ratings : {};

  if (!experienceId || !traineeEmail) {
    return NextResponse.json({ error: "experienceId and traineeEmail are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    const fallback = genericInsight();
    return NextResponse.json({
      success: true,
      gravel: true,
      trainSessionId: null,
      insight: fallback.insight,
      questions: fallback.questions,
      reason: "SUPABASE_SERVICE_ROLE_KEY not configured, train session was not saved",
    });
  }

  const { data: experience } = await admin.from("experiences").select("*").eq("id", experienceId).maybeSingle();
  if (!experience) return NextResponse.json({ error: "experience not found" }, { status: 404 });

  const { data: modules } = await admin
    .from("training_modules")
    .select("id, position, title, objective")
    .eq("experience_id", experienceId)
    .order("position", { ascending: true });
  const moduleList = modules ?? [];

  const companyName = experience.company_name ?? undefined;

  // Ground the questions in the company's real content, same fetchHtml/htmlToText
  // pattern used by /api/detect-team.
  let siteText = "";
  const html = await fetchHtml(experience.source_url);
  if (html) siteText = htmlToText(html, 6000);

  const ratingsSummary = moduleList
    .map((m) => `${m.title}: self-rating ${ratings[m.id] ?? "not rated"} / 5 (objective: ${m.objective})`)
    .join("\n");

  let insight: string;
  let questions: string[];
  let gravel = false;
  let reason: string | undefined;
  try {
    const result = await forcedToolCall<{ insight: string; questions: string[] }>({
      system:
        "You are the training narrator giving a short spoken preliminary read before a live interview with a new trainee. Ground your interview questions in what the company actually does, using the provided site content. No em or en dashes. Never use the word AI in the copy.",
      user: `Company: ${experience.company_name ?? "this company"}\nSite content:\n${siteText || "(site content unavailable)"}\n\nTrainee self-ratings:\n${ratingsSummary || "(no modules rated)"}`,
      tool: INSIGHTS_TOOL,
      maxTokens: 900,
    });
    insight = enforceCopyRules(result.insight, companyName);
    questions = result.questions.slice(0, 4).map((q) => enforceCopyRules(q, companyName));
    while (questions.length < 4) questions.push(genericInsight().questions[questions.length]);
  } catch (err) {
    const fallback = genericInsight();
    insight = fallback.insight;
    questions = fallback.questions;
    gravel = true;
    reason = err instanceof AnthropicUnavailable ? "ANTHROPIC_API_KEY not configured" : "insight generation failed";
  }

  const ratingsMap: Record<string, TrainSessionRating> = {};
  for (const m of moduleList) {
    const self = Number(ratings[m.id]);
    ratingsMap[m.id] = defaultRating(Number.isFinite(self) && self >= 1 && self <= 5 ? self : 3);
  }

  const session = await createTrainSession({
    experience_id: experienceId,
    trainee_email: traineeEmail,
    ratings: ratingsMap,
    // Placeholder order until /api/preinterview/infer locks the real,
    // weakest-inferred-first route. Position order is the most reasonable
    // default in the meantime (Section 11 item 8: routes lock at generation,
    // this isn't locked yet).
    route_order: moduleList.map((m) => m.id),
    pre_interview_insights: insight,
    pre_interview_questions: questions,
  });

  return NextResponse.json({
    success: true,
    gravel,
    reason,
    trainSessionId: session.id,
    insight,
    questions,
  });
}
