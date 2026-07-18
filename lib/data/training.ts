import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TrainingModule, TrainingModuleInsert } from "@/types/database";

export async function listModulesForExperience(experienceId: string): Promise<TrainingModule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .select("*")
    .eq("experience_id", experienceId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertModule(mod: TrainingModuleInsert): Promise<TrainingModule> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

  const { data, error } = await admin
    .from("training_modules")
    .upsert(mod, { onConflict: "experience_id,position" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
