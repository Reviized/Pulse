"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileRole } from "@/types/database";

export type ActionResult = { success: boolean; reason?: string; gravel?: boolean };

export type ProfileFormFields = {
  name: string;
  title: string;
  bio: string;
  role: ProfileRole;
  eleven_voice_id: string;
  replica_video_url: string;
};

export async function createProfile(
  experienceId: string,
  workspaceId: string | null,
  fields: ProfileFormFields
): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };
  if (!fields.name.trim()) return { success: false, reason: "name is required" };

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("experience_id", experienceId);

  const { error } = await admin.from("profiles").insert({
    experience_id: experienceId,
    workspace_id: workspaceId,
    name: fields.name.trim(),
    title: fields.title || null,
    bio: fields.bio || null,
    role: fields.role,
    eleven_voice_id: fields.eleven_voice_id || null,
    replica_video_url: fields.replica_video_url || null,
    display_order: count ?? 0,
  });
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/profiles");
  return { success: true };
}

export async function updateProfile(profileId: string, fields: ProfileFormFields): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };
  if (!fields.name.trim()) return { success: false, reason: "name is required" };

  const { error } = await admin
    .from("profiles")
    .update({
      name: fields.name.trim(),
      title: fields.title || null,
      bio: fields.bio || null,
      role: fields.role,
      eleven_voice_id: fields.eleven_voice_id || null,
      replica_video_url: fields.replica_video_url || null,
    })
    .eq("id", profileId);
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/profiles");
  return { success: true };
}

/**
 * Deleting a profile that happens to be the experience's anchored narrator
 * must clear narrator.profileId, never leave a dangling id for some later
 * "first profile" lookup to silently resolve to the wrong person (Section 4
 * / Section 8 item 2 — the exact bug this codebase documents and refuses to
 * relearn). preferredName is left intact so re-detection can still reanchor
 * by name later.
 */
export async function deleteProfile(profileId: string, experienceId: string): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { data: experience } = await admin
    .from("experiences")
    .select("narrator")
    .eq("id", experienceId)
    .maybeSingle();

  const { error } = await admin.from("profiles").delete().eq("id", profileId);
  if (error) return { success: false, reason: error.message };

  if (experience?.narrator?.profileId === profileId) {
    await admin
      .from("experiences")
      .update({ narrator: { ...experience.narrator, profileId: null, videoUrl: null } })
      .eq("id", experienceId);
  }

  revalidatePath("/admin/profiles");
  return { success: true };
}
