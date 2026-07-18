import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forcedToolCall, AnthropicUnavailable, enforceCopyRules } from "@/lib/anthropic";
import { logBuildMock } from "@/lib/data/build-mocks";
import type { TrainingModuleCheckpoint, TrainingModuleInsert } from "@/types/database";

const OUTLINE_TOOL = {
  name: "curriculum_outline",
  description: "Produces the 4-module outline for a training curriculum.",
  input_schema: {
    type: "object",
    properties: {
      modules: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            objective: { type: "string", description: "One sentence: what a trainee should be able to do after this module." },
          },
          required: ["title", "objective"],
        },
      },
    },
    required: ["modules"],
  },
};

const MODULE_TOOL = {
  name: "curriculum_module",
  description: "Writes the full lesson content for one training module.",
  input_schema: {
    type: "object",
    properties: {
      lesson: { type: "array", items: { type: "string" }, description: "2 to 4 short lesson paragraphs." },
      key_points: { type: "array", items: { type: "string" }, description: "3 to 5 short key takeaways." },
      checkpoint: {
        type: "object",
        properties: {
          q: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["q", "options", "correct"],
      },
    },
    required: ["lesson", "key_points", "checkpoint"],
  },
};

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  if (!experienceId) return NextResponse.json({ error: "experienceId is required" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const { data: experience } = await admin.from("experiences").select("*").eq("id", experienceId).maybeSingle();
  if (!experience) return NextResponse.json({ error: "experience not found" }, { status: 404 });
  const companyName = experience.company_name ?? undefined;

  let outline: { title: string; objective: string }[];
  try {
    const result = await retryOnce(() =>
      forcedToolCall<{ modules: { title: string; objective: string }[] }>({
        system:
          "You design a 4-module training curriculum outline for a company, grounded in what the company actually does. No em or en dashes. Never use the word AI in the copy.",
        user: `Company: ${experience.company_name ?? "this company"}\nSource site: ${experience.source_url}`,
        tool: OUTLINE_TOOL,
        maxTokens: 800,
      })
    );
    outline = result.modules ?? [];
  } catch (err) {
    const reason = err instanceof AnthropicUnavailable ? "ANTHROPIC_API_KEY not configured" : "outline generation failed";
    await logBuildMock("generate-curriculum", "gravel", reason);
    return NextResponse.json({ success: true, gravel: true, reason });
  }

  const survivors: TrainingModuleInsert[] = [];
  for (let i = 0; i < outline.length; i++) {
    const item = outline[i];
    try {
      const detail = await retryOnce(() =>
        forcedToolCall<{
          lesson: string[];
          key_points: string[];
          checkpoint: TrainingModuleCheckpoint;
        }>({
          system:
            "You write the full lesson content for one training module. No em or en dashes. Never use the word AI in the copy.",
          user: `Company: ${experience.company_name ?? "this company"}\nModule title: ${item.title}\nObjective: ${item.objective}`,
          tool: MODULE_TOOL,
          maxTokens: 1500,
        })
      );

      // preserve attached media/speaker/script across regeneration (Section 6, item 5)
      const { data: existing } = await admin
        .from("training_modules")
        .select("speaker_profile_id, media_url, media_kind, script")
        .eq("experience_id", experienceId)
        .eq("position", i)
        .maybeSingle();

      survivors.push({
        experience_id: experienceId,
        position: i,
        title: enforceCopyRules(item.title, companyName),
        objective: enforceCopyRules(item.objective, companyName),
        lesson: detail.lesson.map((l) => enforceCopyRules(l, companyName)),
        key_points: detail.key_points.map((k) => enforceCopyRules(k, companyName)),
        checkpoint: {
          ...detail.checkpoint,
          q: enforceCopyRules(detail.checkpoint.q, companyName),
        },
        speaker_profile_id: existing?.speaker_profile_id ?? null,
        media_url: existing?.media_url ?? null,
        media_kind: existing?.media_kind ?? null,
        script: existing?.script ?? null,
      });
    } catch {
      // skip a failed module, per Section 6 item 5
      continue;
    }
  }

  if (survivors.length < 3) {
    await logBuildMock(
      "generate-curriculum",
      "gravel",
      `only ${survivors.length} of ${outline.length} modules survived, need at least 3`
    );
    return NextResponse.json({
      success: true,
      gravel: true,
      reason: `only ${survivors.length} of ${outline.length} modules generated successfully, need at least 3`,
    });
  }

  const { data: modules, error } = await admin
    .from("training_modules")
    .upsert(survivors, { onConflict: "experience_id,position" })
    .select("*")
    .order("position", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, gravel: false, modules });
}
