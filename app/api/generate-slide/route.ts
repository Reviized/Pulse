import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forcedToolCall, AnthropicUnavailable, enforceCopyRules } from "@/lib/anthropic";
import { logBuildMock } from "@/lib/data/build-mocks";
import type { SlideInsert, SlideLayout, SlideSpecial, SlideTextPos } from "@/types/database";

const GENERATE_SLIDE_TOOL = {
  name: "generate_slide_content",
  description: "Writes the copy for one slide in a branded scroll deck, matching the requested layout.",
  input_schema: {
    type: "object",
    properties: {
      eyebrow: { type: "string", description: "Short label above the headline, 2 to 4 words." },
      headline: { type: "string", description: "Main headline. Punchy, no more than 12 words. Never use an em dash or en dash." },
      body: { type: "string", description: "1 to 3 sentences of supporting copy. Never use an em dash or en dash." },
      sig: { type: "string", description: "Optional short signature or quote line. Empty string if not applicable." },
      script: { type: "string", description: "2 to 4 sentence spoken narration script for this slide." },
      items: {
        type: "array",
        description: "Only populated for a stats layout: 3 to 4 short {label, value} stat pairs. Empty array otherwise.",
        items: {
          type: "object",
          properties: { label: { type: "string" }, value: { type: "string" } },
          required: ["label", "value"],
        },
      },
    },
    required: ["eyebrow", "headline", "body", "sig", "script", "items"],
  },
};

async function buildTeamSlide(admin: ReturnType<typeof createAdminClient>, experienceId: string) {
  const { data: profiles } = await admin!
    .from("profiles")
    .select("*")
    .eq("experience_id", experienceId)
    .order("display_order", { ascending: true });
  return {
    eyebrow: "The Team",
    headline: "The people behind this",
    body: null,
    sig: null,
    script: null,
    items: (profiles ?? []).map((p) => ({ name: p.name, title: p.title, headshot_url: p.headshot_url })),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const position = typeof body?.position === "number" ? body.position : null;
  const layout = body?.layout as SlideLayout | undefined;
  const special = (body?.special ?? null) as SlideSpecial;
  const textPos = (body?.textPos ?? null) as SlideTextPos;
  const speakerProfileId = (body?.speakerProfileId ?? null) as string | null;
  const brief = typeof body?.brief === "string" ? body.brief : "";
  const label = typeof body?.label === "string" ? body.label : null;

  if (!experienceId || position === null || !layout) {
    return NextResponse.json({ error: "experienceId, position, and layout are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const { data: experience } = await admin.from("experiences").select("*").eq("id", experienceId).maybeSingle();
  if (!experience) return NextResponse.json({ error: "experience not found" }, { status: 404 });

  let content: {
    eyebrow: string | null;
    headline: string | null;
    body: string | null;
    sig: string | null;
    script: string | null;
    items: unknown[];
  };
  let gravel = false;

  if (special === "team") {
    content = await buildTeamSlide(admin, experienceId);
  } else if (special === "spotlight" && speakerProfileId) {
    const { data: speaker } = await admin.from("profiles").select("*").eq("id", speakerProfileId).maybeSingle();
    content = {
      eyebrow: "Leader Spotlight",
      headline: speaker?.name ?? "",
      body: speaker?.bio ?? null,
      sig: speaker?.title ?? null,
      script: speaker?.bio ?? null,
      items: [],
    };
  } else if (special === "ask") {
    content = {
      eyebrow: "Ask Anything",
      headline: "Have a question?",
      body: "Ask below and we will answer, grounded in what you just saw.",
      sig: null,
      script: null,
      items: [],
    };
  } else {
    try {
      const result = await forcedToolCall<{
        eyebrow: string; headline: string; body: string; sig: string; script: string; items: { label: string; value: string }[];
      }>({
        system:
          "You write one slide of copy at a time for a branded interactive deck. Match the requested layout and brief exactly. No em dashes or en dashes anywhere, use commas instead. Never use the word AI in the copy; if you must refer to generation, say Generate or Generate media.",
        user: `Company: ${experience.company_name ?? "this company"}\nLayout: ${layout}\nSlide purpose: ${label ?? ""}\nBrief: ${brief}`,
        tool: GENERATE_SLIDE_TOOL,
      });
      const companyName = experience.company_name ?? undefined;
      content = {
        eyebrow: enforceCopyRules(result.eyebrow, companyName),
        headline: enforceCopyRules(result.headline, companyName),
        body: enforceCopyRules(result.body, companyName),
        sig: result.sig ? enforceCopyRules(result.sig, companyName) : null,
        script: result.script ? enforceCopyRules(result.script, companyName) : null,
        items: layout === "stats" ? result.items ?? [] : [],
      };
    } catch (err) {
      gravel = true;
      const reason = err instanceof AnthropicUnavailable ? "ANTHROPIC_API_KEY not configured" : "generation failed";
      await logBuildMock("generate-slide", "gravel", `position ${position} (${layout}): ${reason}`);
      content = {
        eyebrow: label,
        headline: `${label ?? "Slide"}, gravel road`,
        body: `Content pending: ${reason}.`,
        sig: null,
        script: null,
        items: [],
      };
    }
  }

  const slideRow: SlideInsert = {
    experience_id: experienceId,
    position,
    layout,
    special,
    text_pos: textPos,
    speaker_profile_id: speakerProfileId,
    label,
    eyebrow: content.eyebrow,
    headline: content.headline,
    body: content.body,
    sig: content.sig,
    script: content.script,
    items: content.items,
  };

  const { data: slide, error } = await admin
    .from("slides")
    .upsert(slideRow, { onConflict: "experience_id,position" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, gravel, slide });
}
