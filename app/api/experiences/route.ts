import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("experiences")
      .insert({ source_url: url.toString(), company_name: companyName, mode })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, gravel: false, experience: data });
  } catch (err) {
    // No live service-role-backed project reachable yet (expected until the
    // new Supabase project exists — see build plan). Gravel Road: mock and
    // label it rather than block the Front Door flow.
    console.warn("pulse-experiences: falling back to a mock experience —", err);
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
