import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logBuildMock } from "@/lib/data/build-mocks";
import type { ExperienceMode } from "@/types/database";

const VALID_MODES: ExperienceMode[] = ["inform", "train", "sell"];

function deriveCompanyName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Your Company";
  }
}

/**
 * POST /api/experiences — creates the experience row that anchors a Front Door
 * run. Section 6 of the master prompt doesn't number this as a standalone
 * route (experience creation is the implicit first step of the "GO" pipeline),
 * but it's split out here as its own endpoint for a clean gravel-road fallback
 * boundary: real insert if a service-role-backed Supabase project is reachable,
 * a labeled mock id otherwise, per Section 4 (never block on a missing
 * integration, log it to build_mocks, continue).
 *
 * REAL BUG, FIXED: this used to insert via the anon client (lib/supabase/
 * server.ts). `experiences` is service-role-write-only per migration 0001's
 * RLS policy, so every insert was silently rejected and this fell back to
 * the gravel mock unconditionally — with a fully correct
 * SUPABASE_SERVICE_ROLE_KEY configured elsewhere, this route still never
 * used it. Every downstream step (detect-team, generate-curriculum,
 * generate-slide) depends on a real experience id existing first, so this
 * one bug alone caused the entire pipeline to look "fast" and always land
 * on gravel, regardless of what any other route did correctly.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  const mode = body?.mode as ExperienceMode | undefined;

  if (!rawUrl || !mode || !VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: "url and a valid mode (inform|train|sell) are required" },
      { status: 400 }
    );
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "not a valid URL" }, { status: 400 });
  }

  const companyName = deriveCompanyName(url.toString());

  const admin = createAdminClient();
  if (!admin) {
    await logBuildMock("experiences", "gravel", "SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json({
      success: true,
      gravel: true,
      experience: {
        id: "gravel-" + Math.random().toString(36).slice(2, 10),
        workspace_id: null,
        source_url: url.toString(),
        company_name: companyName,
        mode,
        design_spec: null,
        narrator: null,
        is_master: false,
        parent_id: null,
        access_code: "REV123",
        pilot_mode: true,
        intro_video_url: null,
        replica_path: "reviized",
        created_at: new Date(0).toISOString(),
      },
    });
  }

  try {
    const { data, error } = await admin
      .from("experiences")
      .insert({ source_url: url.toString(), company_name: companyName, mode })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, gravel: false, experience: data });
  } catch (err) {
    // A real, unexpected failure with a service-role client configured
    // (network blip, RLS misconfigured, etc.) — log it distinctly from the
    // expected no-key gravel path above so Build Status can tell them apart.
    console.warn("pulse-experiences: real insert failed —", err);
    await logBuildMock(
      "experiences",
      "gravel",
      `service-role insert failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
    return NextResponse.json({
      success: true,
      gravel: true,
      experience: {
        id: "gravel-" + Math.random().toString(36).slice(2, 10),
        workspace_id: null,
        source_url: url.toString(),
        company_name: companyName,
        mode,
        design_spec: null,
        narrator: null,
        is_master: false,
        parent_id: null,
        access_code: "REV123",
        pilot_mode: true,
        intro_video_url: null,
        replica_path: "reviized",
        created_at: new Date(0).toISOString(),
      },
    });
  }
}
