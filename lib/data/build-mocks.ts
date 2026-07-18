import { createClient } from "@/lib/supabase/server";
import type { BuildMock } from "@/types/database";

/**
 * Section 4: every mock fallback logs a build_mocks row so Build Status can
 * surface a real running log instead of a hardcoded list. Public-read table
 * (migration 0001), so the anon client is enough here.
 */
export async function listBuildMocks(): Promise<BuildMock[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("build_mocks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}
