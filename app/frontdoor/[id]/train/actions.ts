"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTrainSessionForTrainee,
  getTrainSessionRaw,
  updateTrainSession,
  type TraineeSafeTrainSession,
} from "@/lib/data/train-sessions";
import type { TrainSessionRating } from "@/types/database";

/**
 * Server Actions, not new /api routes: everything here lives under
 * app/frontdoor/[id]/train (this build's scoped directory) and each
 * function fully controls its own return shape, which is how the RLS rule
 * (train_sessions.signal/.transcript/.inferred are Owner/Admin read-only,
 * never trainee-facing) gets enforced for reads that aren't the three named
 * /api/preinterview/* routes. Nothing here ever returns a raw train_sessions
 * row — see the explicit field lists below.
 */

export type RatingModule = { id: string; position: number; title: string; objective: string };

export async function getModulesForRating(experienceId: string): Promise<RatingModule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .select("id, position, title, objective")
    .eq("experience_id", experienceId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type PlayerModule = {
  id: string;
  position: number;
  title: string;
  objective: string;
  lesson: string[];
  keyPoints: string[];
  // Deliberately no `correct` field — the answer key must never reach the
  // client before the trainee answers (master prompt Section 9, item 6).
  checkpoint: { q: string; options: [string, string, string, string] } | null;
  mediaUrl: string | null;
  mediaKind: string | null;
};

export async function getModulesForPlayer(experienceId: string, routeOrder: string[]): Promise<PlayerModule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .select("*")
    .eq("experience_id", experienceId);
  if (error) throw error;
  const byId = new Map((data ?? []).map((m) => [m.id, m]));
  const order = routeOrder.length > 0 ? routeOrder : (data ?? []).sort((a, b) => a.position - b.position).map((m) => m.id);

  const out: PlayerModule[] = [];
  for (const id of order) {
    const m = byId.get(id);
    if (!m) continue; // route_order id no longer resolves to a live module — skip rather than crash the player
    out.push({
      id: m.id,
      position: m.position,
      title: m.title,
      objective: m.objective,
      lesson: m.lesson ?? [],
      keyPoints: m.key_points ?? [],
      checkpoint: m.checkpoint ? { q: m.checkpoint.q, options: m.checkpoint.options } : null,
      mediaUrl: m.media_url,
      mediaKind: m.media_kind,
    });
  }
  return out;
}

export async function fetchTraineeSession(trainSessionId: string): Promise<TraineeSafeTrainSession | null> {
  return getTrainSessionForTrainee(trainSessionId);
}

/**
 * Checks the trainee's answer against the real checkpoint.correct index
 * server-side and only ever returns whether they got it right — never the
 * correct index itself (so a retry can't be gamed) and never `inferred`
 * or `signal`.
 */
export async function submitCheckpointAnswer(
  trainSessionId: string,
  moduleId: string,
  selectedIndex: number
): Promise<{ success: boolean; correct: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { success: false, correct: false };

  const { data: mod, error } = await admin
    .from("training_modules")
    .select("id, checkpoint")
    .eq("id", moduleId)
    .maybeSingle();
  if (error || !mod?.checkpoint) return { success: false, correct: false };

  const correct = mod.checkpoint.correct === selectedIndex;

  const session = await getTrainSessionRaw(trainSessionId);
  if (!session) return { success: false, correct };

  const ratings: Record<string, TrainSessionRating> = { ...session.ratings };
  const existing = ratings[moduleId] ?? { self: 3, inferred: null, checkpoint: null, note: null };
  ratings[moduleId] = { ...existing, checkpoint: correct };
  await updateTrainSession(trainSessionId, { ratings });

  return { success: true, correct };
}

/** Marks the session complete. Returns the same trainee-safe shape the
 * results screen renders from — self ratings + checkpoint pass/fail only. */
export async function completeTrainSession(trainSessionId: string): Promise<TraineeSafeTrainSession | null> {
  await updateTrainSession(trainSessionId, { completed_at: new Date().toISOString() });
  return getTrainSessionForTrainee(trainSessionId);
}
