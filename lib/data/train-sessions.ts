import { createAdminClient } from "@/lib/supabase/admin";
import type { TrainSession, TrainSessionInsert, TrainSessionRating } from "@/types/database";

/**
 * CRITICAL RLS RULE (master prompt Section 5, non-negotiable): `signal`,
 * `transcript`, and inferred-vs-self analysis on train_sessions are
 * Owner/Admin read-only. The trainee must never see them, in the UI or in
 * any API/server-action response addressed to them. This mirrors the
 * "never resolve a stale id through a forgiving fallback" lesson in
 * CLAUDE.md: the fix there was to check membership explicitly rather than
 * trust a caller to remember the guard. The fix here is the same shape —
 * a single explicitly-whitelisted read path (getTrainSessionForTrainee)
 * that every trainee-facing screen must go through, rather than a raw
 * `select('*')` that depends on every future caller remembering to strip
 * fields by hand.
 */

export type TraineeSafeRating = { self: number; checkpoint: boolean | null };

export type TraineeSafeTrainSession = {
  id: string;
  experienceId: string;
  routeOrder: string[];
  ratings: Record<string, TraineeSafeRating>;
  preInterviewInsights: string | null;
  preInterviewQuestions: string[] | null;
  completedAt: string | null;
};

function stripToTraineeSafe(row: TrainSession): TraineeSafeTrainSession {
  const ratings: Record<string, TraineeSafeRating> = {};
  for (const [moduleId, r] of Object.entries(row.ratings ?? {})) {
    ratings[moduleId] = { self: r.self, checkpoint: r.checkpoint ?? null };
  }
  return {
    id: row.id,
    experienceId: row.experience_id,
    routeOrder: row.route_order ?? [],
    ratings,
    preInterviewInsights: row.pre_interview_insights,
    preInterviewQuestions: row.pre_interview_questions,
    completedAt: row.completed_at,
  };
}

/**
 * Owner/Admin-only full row. Never pass this object (or any field pulled
 * from it) directly into a trainee-facing API response or server action
 * return value — use getTrainSessionForTrainee for anything the trainee's
 * browser will see.
 */
export async function getTrainSessionRaw(id: string): Promise<TrainSession | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("train_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Explicit trainee-safe whitelist: self ratings + checkpoint pass/fail + the questions/insight
 * they were already shown before the interview. No `signal`, no `transcript`, no `.inferred`,
 * no `.note`. */
export async function getTrainSessionForTrainee(id: string): Promise<TraineeSafeTrainSession | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("train_sessions")
    .select(
      "id, experience_id, route_order, ratings, pre_interview_insights, pre_interview_questions, completed_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return stripToTraineeSafe(data as TrainSession);
}

export async function createTrainSession(insert: TrainSessionInsert): Promise<TrainSession> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { data, error } = await admin.from("train_sessions").insert(insert).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTrainSession(
  id: string,
  patch: Partial<TrainSessionInsert>
): Promise<TrainSession> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const { data, error } = await admin.from("train_sessions").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

/** Read-modify-write append, used to persist the live interview transcript
 * incrementally (Section 6 item 7: "not just at the end, so a dropped
 * connection doesn't lose it"). */
export async function appendTranscriptEntry(
  id: string,
  entry: { q: string; a: string }
): Promise<TrainSession> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  const current = await getTrainSessionRaw(id);
  if (!current) throw new Error("train session not found");
  const transcript = [...(current.transcript ?? []), entry];
  return updateTrainSession(id, { transcript });
}

/** Default rating shape for a module the trainee hasn't rated yet — used only
 * as a safe fallback while building the initial ratings map, never as a
 * silent fallback for a stale/missing id (that's the exact bug class
 * CLAUDE.md calls out; this is just a numeric default, not an identity
 * resolution). */
export function defaultRating(self: number): TrainSessionRating {
  return { self, inferred: null, checkpoint: null, note: null };
}
