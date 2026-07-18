"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertReplicaJob } from "@/lib/data/replica-jobs";
import { POST as reviizedRoute } from "@/app/api/replica/reviized/route";
import type { ReplicaJobPayload, ReplicaJobStatus } from "@/types/database";

export type ActionResult = { success: boolean; reason?: string; gravel?: boolean };

export type ReplicaFormFields = {
  replica_script: string;
  reviized_project_id: string;
  reviized_video_id: string;
  reviized_voice_id: string;
};

function toIntOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function updateReplicaFields(profileId: string, fields: ReplicaFormFields): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { error } = await admin
    .from("profiles")
    .update({
      replica_script: fields.replica_script || null,
      reviized_project_id: toIntOrNull(fields.reviized_project_id),
      reviized_video_id: toIntOrNull(fields.reviized_video_id),
      reviized_voice_id: toIntOrNull(fields.reviized_voice_id),
    })
    .eq("id", profileId);
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/replica-studio");
  return { success: true };
}

/**
 * Section 7: "A 'Queue REViiZED job' button calls POST /api/replica/reviized
 * server-side ... and writes the row to replica_jobs." This action IS the
 * server side of that button — a Next.js server action already runs on the
 * server, so it invokes the route's exported POST handler in-process
 * (same honest-stub logic, no fabricated origin/host to fetch() against)
 * rather than round-tripping an HTTP call to itself, then writes the
 * replica_jobs row regardless of outcome per the spec: HOLD when gravel.
 */
export async function queueReviizedJob(
  profileId: string
): Promise<ActionResult & { jobId?: string; jobStatus?: ReplicaJobStatus }> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { data: profile, error } = await admin.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (error || !profile) return { success: false, reason: error?.message ?? "profile not found" };

  const payload: ReplicaJobPayload = {
    project: profile.reviized_project_id,
    name: profile.name,
    script: profile.replica_script ?? "",
    video: profile.reviized_video_id,
    voice: profile.reviized_voice_id,
  };

  let gravel = true;
  let reason = "REVIIZED_USERNAME/PASSWORD not configured";
  try {
    const res = await reviizedRoute(
      new Request("http://internal/api/replica/reviized", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    const json = (await res.json()) as { success: boolean; gravel?: boolean; reason?: string };
    gravel = Boolean(json.gravel);
    reason = json.reason ?? reason;
  } catch (err) {
    reason = err instanceof Error ? err.message : "the reviized route threw an unknown error";
  }

  const status: ReplicaJobStatus = gravel ? "HOLD" : "REQUESTED";
  const job = await insertReplicaJob({
    profile_id: profileId,
    payload: { ...payload, notes: reason },
    status,
  });

  revalidatePath("/admin/replica-studio");
  return { success: true, gravel, reason, jobId: job?.id, jobStatus: job?.status };
}
