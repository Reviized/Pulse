import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BuildMock, BuildMockStatus } from "@/types/database";

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

/**
 * The writer side of the rule above. build_mocks has no public-insert policy
 * (migration 0001: read-only for anon), so this is service-role only, and
 * deliberately never throws — a logging side-effect must never break the
 * route that called it. Call this from every place a route falls back to a
 * gravel response, not just the ones that happen to remember to.
 */
export async function logBuildMock(feature: string, status: BuildMockStatus, note: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("build_mocks").insert({ feature, status, note });
  } catch {
    // best-effort only
  }
}
