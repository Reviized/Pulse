import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, ProfileInsert } from "@/types/database";

export async function listProfilesForExperience(experienceId: string): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("experience_id", experienceId)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Replaces the full team list for an experience. Team detection re-runs the
 * whole site scrape each time, so ids are never stable across runs by
 * design (Section 8, item 3) — the narrator reanchors by name separately in
 * reanchorNarrator, never by assuming an id survived.
 */
export async function replaceProfilesForExperience(
  experienceId: string,
  workspaceId: string | null,
  profiles: Omit<ProfileInsert, "experience_id" | "workspace_id">[]
): Promise<Profile[]> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

  const { error: deleteError } = await admin
    .from("profiles")
    .delete()
    .eq("experience_id", experienceId);
  if (deleteError) throw deleteError;

  if (profiles.length === 0) return [];

  const { data, error } = await admin
    .from("profiles")
    .insert(
      profiles.map((p) => ({ ...p, experience_id: experienceId, workspace_id: workspaceId }))
    )
    .select("*");
  if (error) throw error;
  return data ?? [];
}
