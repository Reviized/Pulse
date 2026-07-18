import { createAdminClient } from "@/lib/supabase/admin";
import type { Lead } from "@/types/database";

/**
 * `leads` has no public-select RLS policy (migration 0001 only grants public
 * INSERT, for The Gate) — reading it back is an Admin-only operation by
 * design, so this always goes through the service-role client and returns
 * [] gracefully (per lib/supabase/admin.ts's contract) when it isn't
 * configured, rather than throwing.
 */
export async function listLeadsForExperience(experienceId: string): Promise<Lead[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("leads")
    .select("*")
    .eq("experience_id", experienceId)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
