import { createAdminClient } from "@/lib/supabase/admin";
import type { ReplicaJob, ReplicaJobInsert } from "@/types/database";

/**
 * `replica_jobs` is service-role only end to end (migration 0001's
 * "service role only" policy) — Replica Studio always reads/writes through
 * the admin client and treats a missing SUPABASE_SERVICE_ROLE_KEY as an
 * honest empty state, never a thrown error that would blank the page.
 */
export async function listReplicaJobsForProfile(profileId: string): Promise<ReplicaJob[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("replica_jobs")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listReplicaJobsForExperience(profileIds: string[]): Promise<ReplicaJob[]> {
  if (profileIds.length === 0) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("replica_jobs")
    .select("*")
    .in("profile_id", profileIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function insertReplicaJob(job: ReplicaJobInsert): Promise<ReplicaJob | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.from("replica_jobs").insert(job).select("*").single();
  if (error) throw error;
  return data;
}
