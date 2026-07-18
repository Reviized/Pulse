import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The Intelligence Loop's cohesion stage (Section 6, item 16; Section 11,
 * item 9): runs after every generation call, never as a one-off. Checks
 * banned patterns (company-name masked), the no-dash typography rule as a
 * safety net behind enforceCopyRules, and completeness. Train mode with
 * zero modules reports exactly one item, never per-slide noise about a
 * deck that was never supposed to exist yet (Section 6, item 16).
 */

const TEXT_FIELDS = ["eyebrow", "headline", "body", "sig", "script"] as const;
const MODULE_TEXT_FIELDS = ["title", "objective"] as const;

function bannedWordIssues(text: string | null, companyName: string | undefined, field: string): string[] {
  if (!text) return [];
  const stripped = companyName?.replace(/[-\s](AI|A\.I\.?)$/i, "").trim();
  const protectedNames = Array.from(new Set([companyName, stripped].filter((n): n is string => Boolean(n))));
  let masked = text;
  for (const name of protectedNames) {
    masked = masked.split(name).join(" ".repeat(name.length));
  }
  const issues: string[] = [];
  if (/\bAI\b/.test(masked)) issues.push(`${field} uses the banned word "AI"`);
  if (/[–—]/.test(text)) issues.push(`${field} contains an em or en dash`);
  return issues;
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

  const items: { type: "slide" | "module" | "info"; id?: string; position?: number; issues: string[] }[] = [];

  if (experience.mode === "train") {
    const { data: modules } = await admin
      .from("training_modules")
      .select("*")
      .eq("experience_id", experienceId)
      .order("position", { ascending: true });

    if (!modules || modules.length === 0) {
      items.push({ type: "info", issues: ["no curriculum generated yet"] });
    } else {
      for (const m of modules) {
        const issues: string[] = [];
        for (const field of MODULE_TEXT_FIELDS) {
          issues.push(...bannedWordIssues(m[field] as string, companyName, field));
        }
        (m.lesson ?? []).forEach((l: string, i: number) => issues.push(...bannedWordIssues(l, companyName, `lesson[${i}]`)));
        (m.key_points ?? []).forEach((k: string, i: number) => issues.push(...bannedWordIssues(k, companyName, `key_points[${i}]`)));
        if (!m.checkpoint) issues.push("missing checkpoint");
        if (issues.length > 0) items.push({ type: "module", id: m.id, position: m.position, issues });
        await admin.from("training_modules").update({ cohesion: { issues, checked_at: new Date().toISOString() } }).eq("id", m.id);
      }
    }
  } else {
    const { data: slides } = await admin
      .from("slides")
      .select("*")
      .eq("experience_id", experienceId)
      .order("position", { ascending: true });

    if (!slides || slides.length === 0) {
      items.push({ type: "info", issues: ["no slides generated yet"] });
    } else {
      const layoutsSeen = new Set(slides.map((s) => s.layout));
      const allLayouts = ["text_only", "media_full", "split", "three_quarter", "stats", "waveform"];
      const missingLayouts = allLayouts.filter((l) => !layoutsSeen.has(l as never));
      if (missingLayouts.length > 0) {
        items.push({ type: "info", issues: [`layouts never used in this deck: ${missingLayouts.join(", ")}`] });
      }

      for (const s of slides) {
        const issues: string[] = [];
        for (const field of TEXT_FIELDS) {
          issues.push(...bannedWordIssues(s[field] as string, companyName, field));
        }
        if (!s.special && !s.headline) issues.push("missing headline");
        if (issues.length > 0) items.push({ type: "slide", id: s.id, position: s.position, issues });
        await admin.from("slides").update({ cohesion: { issues, checked_at: new Date().toISOString() } }).eq("id", s.id);
      }
    }
  }

  return NextResponse.json({ success: true, gravel: false, items, clean: items.length === 0 });
}
