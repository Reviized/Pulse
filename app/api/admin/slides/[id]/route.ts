import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SlideInsert } from "@/types/database";

/**
 * Slide Manager's inline editor (Section 9's Admin panel). JSON-only PATCH
 * over eyebrow/headline/body/sig/script/speaker_profile_id — media upload
 * is handled separately by the uploadSlideMedia server action
 * (app/admin/_actions/media.ts) since it needs multipart form data and this
 * route stays simple. Service-role only, matching migration 0001's
 * "service role only updates slides" policy.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      success: false,
      gravel: true,
      reason: "SUPABASE_SERVICE_ROLE_KEY not configured",
    });
  }

  const body = (await req.json().catch(() => null)) as Partial<SlideInsert> | null;
  if (!body) {
    return NextResponse.json({ success: false, error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<SlideInsert> = {};
  if ("eyebrow" in body) patch.eyebrow = body.eyebrow ?? null;
  if ("headline" in body) patch.headline = body.headline ?? null;
  if ("body" in body) patch.body = body.body ?? null;
  if ("sig" in body) patch.sig = body.sig ?? null;
  if ("script" in body) patch.script = body.script ?? null;
  if ("speaker_profile_id" in body) patch.speaker_profile_id = body.speaker_profile_id ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "no editable fields provided" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("slides")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, slide: data });
}
