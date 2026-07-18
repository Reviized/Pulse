import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TrainingModuleInsert } from "@/types/database";

/**
 * Curriculum Manager's inline editor — the training_modules analog of
 * app/api/admin/slides/[id]/route.ts. Media upload goes through
 * uploadModuleMedia (app/admin/_actions/media.ts) instead of this route.
 * training_modules has no explicit RLS UPDATE policy (migration 0001), but
 * the service-role key bypasses RLS entirely, matching the admin client's
 * use elsewhere (e.g. upsertModule in lib/data/training.ts).
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

  const body = (await req.json().catch(() => null)) as Partial<TrainingModuleInsert> | null;
  if (!body) {
    return NextResponse.json({ success: false, error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<TrainingModuleInsert> = {};
  if ("title" in body) patch.title = body.title ?? "";
  if ("objective" in body) patch.objective = body.objective ?? "";
  if ("script" in body) patch.script = body.script ?? null;
  if ("speaker_profile_id" in body) patch.speaker_profile_id = body.speaker_profile_id ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "no editable fields provided" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("training_modules")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, module: data });
}
