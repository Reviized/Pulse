import { createClient } from "@/lib/supabase/server";
import type { Experience, Slide } from "@/types/database";

export async function listExperiences(): Promise<Experience[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("experiences")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getExperience(id: string): Promise<Experience | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("experiences")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSlidesForExperience(
  experienceId: string
): Promise<Slide[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("slides")
    .select("*")
    .eq("experience_id", experienceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
