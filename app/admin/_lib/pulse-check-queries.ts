import { createAdminClient } from "@/lib/supabase/admin";
import type { TrainSession } from "@/types/database";

/**
 * Pulse Check's data layer. Kept local to app/admin (rather than added to
 * lib/data/analytics.ts, which is out of scope for this pass and already
 * owned by the client-side dwell-tracking work) — analytics_events and
 * train_sessions both have no public-select RLS policy (migration 0001), so
 * every read here goes through the service-role client and degrades to an
 * honest empty result, never a thrown error, when it isn't configured.
 */

export type ExperienceTiles = {
  views: number;
  completes: number;
  ppOpens: number;
  leads: number;
};

const EMPTY_TILES: ExperienceTiles = { views: 0, completes: 0, ppOpens: 0, leads: 0 };

export async function getExperienceTiles(experienceId: string): Promise<ExperienceTiles> {
  const admin = createAdminClient();
  if (!admin) return EMPTY_TILES;

  const [viewsRes, completesRes, ppOpensRes, leadsRes] = await Promise.all([
    admin.from("analytics_events").select("id", { count: "exact", head: true }).eq("experience_id", experienceId).eq("event", "view"),
    admin.from("analytics_events").select("id", { count: "exact", head: true }).eq("experience_id", experienceId).eq("event", "complete"),
    admin.from("analytics_events").select("id", { count: "exact", head: true }).eq("experience_id", experienceId).eq("event", "pp_open"),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("experience_id", experienceId),
  ]);

  return {
    views: viewsRes.count ?? 0,
    completes: completesRes.count ?? 0,
    ppOpens: ppOpensRes.count ?? 0,
    leads: leadsRes.count ?? 0,
  };
}

export type DwellPoint = { slideRef: string; avgValue: number; samples: number };

export async function getDwellBySlide(experienceId: string): Promise<DwellPoint[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("analytics_events")
    .select("slide_ref, value")
    .eq("experience_id", experienceId)
    .eq("event", "dwell");
  if (error) throw error;

  const groups = new Map<string, { total: number; count: number }>();
  for (const row of data ?? []) {
    if (!row.slide_ref) continue;
    const g = groups.get(row.slide_ref) ?? { total: 0, count: 0 };
    g.total += row.value ?? 0;
    g.count += 1;
    groups.set(row.slide_ref, g);
  }

  return Array.from(groups.entries()).map(([slideRef, g]) => ({
    slideRef,
    avgValue: g.count > 0 ? g.total / g.count : 0,
    samples: g.count,
  }));
}

export async function getTrainSessionsForExperience(experienceId: string): Promise<TrainSession[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("train_sessions")
    .select("*")
    .eq("experience_id", experienceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
