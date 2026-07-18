"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExperienceMode, ReplicaPath } from "@/types/database";

export type ActionResult = { success: boolean; reason?: string; gravel?: boolean };

export async function updatePilotMode(experienceId: string, pilotMode: boolean): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { error } = await admin.from("experiences").update({ pilot_mode: pilotMode }).eq("id", experienceId);
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/integrations");
  return { success: true };
}

export async function updateReplicaPath(experienceId: string, replicaPath: ReplicaPath): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { error } = await admin.from("experiences").update({ replica_path: replicaPath }).eq("id", experienceId);
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/integrations");
  return { success: true };
}

/**
 * Gravel-road default: switching mode only flips experiences.mode itself.
 * It deliberately does not migrate or regenerate content between slides and
 * training_modules — Inform/Sell and Train are "a completely different
 * experience" per Section 9, so a mode switch is a signal to regenerate via
 * Slide Manager / Curriculum Manager afterward, not a silent data migration
 * this action should attempt on its own.
 */
export async function updateExperienceMode(experienceId: string, mode: ExperienceMode): Promise<ActionResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const { error } = await admin.from("experiences").update({ mode }).eq("id", experienceId);
  if (error) return { success: false, reason: error.message };

  revalidatePath("/admin/integrations");
  return { success: true };
}
