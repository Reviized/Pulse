import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJobStatus, ReviizedUnavailable, ReviizedApiError } from "@/lib/reviized";
import { rehostFile } from "@/lib/storage";
import type { ReplicaJobStatus } from "@/types/database";

const POLL_INTERVAL_MS = 60_000;

/**
 * Thin server wrapper over GET /v1/jobs/{id}/ (Section 7's Replica Studio
 * spec), keyed by our own replica_jobs.id (not the REViiZED numeric id, the
 * client never needs that). Throttled against replica_jobs.updated_at
 * rather than an in-memory timer, so the "at most once per minute" rule
 * holds even across server restarts or multiple client tabs polling the
 * same job.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const { data: row } = await admin.from("replica_jobs").select("*").eq("id", params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "replica job not found" }, { status: 404 });

  if (!row.reviized_job_id) {
    return NextResponse.json({ success: true, gravel: true, reason: "no REViiZED job id on this row yet", job: row });
  }

  // Terminal states never change again — never re-poll them.
  if (row.status === "COMPLETE" || row.status === "ERROR") {
    return NextResponse.json({ success: true, gravel: false, polled: false, job: row });
  }

  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs < POLL_INTERVAL_MS) {
    return NextResponse.json({ success: true, gravel: false, polled: false, job: row });
  }

  try {
    const live = await getJobStatus(row.reviized_job_id);
    const status = live.status as ReplicaJobStatus;
    let outputUrl = row.output_url;

    if (status === "COMPLETE" && live.output?.url && !outputUrl) {
      const rehosted = await rehostFile(live.output.url, "replicas", `replica-${row.profile_id}`);
      outputUrl = rehosted.url;
      await propagateCompletedReplica(admin, row.profile_id, outputUrl);
    }

    const { data: updated } = await admin
      .from("replica_jobs")
      .update({ status, output_url: outputUrl, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("*")
      .single();

    return NextResponse.json({ success: true, gravel: false, polled: true, job: updated ?? row });
  } catch (err) {
    const reason =
      err instanceof ReviizedUnavailable || err instanceof ReviizedApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "status poll failed";
    return NextResponse.json({ success: true, gravel: true, reason, job: row });
  }
}

/**
 * On a completed render: update the profile's replica_video_url (the
 * schema's source of truth), the opening media_full/special=video slide for
 * every experience where this profile speaks (matched by
 * speaker_profile_id, never a blanket "first slide" guess), and the
 * experience's narrator.videoUrl snapshot when this profile IS that
 * experience's current narrator — otherwise a completed render would sit on
 * the profile row without the deck or Train mode's intro ever picking it up.
 */
async function propagateCompletedReplica(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  profileId: string | null,
  videoUrl: string
) {
  if (!profileId) return;

  await admin.from("profiles").update({ replica_video_url: videoUrl }).eq("id", profileId);

  await admin
    .from("slides")
    .update({ media_url: videoUrl, media_kind: "video" })
    .eq("speaker_profile_id", profileId)
    .eq("special", "video");

  const { data: profile } = await admin.from("profiles").select("experience_id").eq("id", profileId).maybeSingle();
  if (!profile?.experience_id) return;

  const { data: experience } = await admin
    .from("experiences")
    .select("id, narrator")
    .eq("id", profile.experience_id)
    .maybeSingle();
  if (experience?.narrator?.profileId === profileId) {
    await admin
      .from("experiences")
      .update({ narrator: { ...experience.narrator, videoUrl } })
      .eq("id", experience.id);
  }
}
