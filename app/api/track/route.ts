import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsEventInsert, AnalyticsEventName } from "@/types/database";

type TrackedEvent = { event: AnalyticsEventName; slideRef?: string; value?: number };

/**
 * Batched analytics writes only (Section 11, item 6: "per-scroll writes
 * melted storage in the prototype"). Callers flush a queue client-side
 * every ~10s rather than firing one request per event.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const sessionKey = typeof body?.sessionKey === "string" ? body.sessionKey : null;
  const events = Array.isArray(body?.events) ? (body.events as TrackedEvent[]) : [];

  if (!experienceId || events.length === 0) {
    return NextResponse.json({ error: "experienceId and at least one event are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const rows: AnalyticsEventInsert[] = events.map((e) => ({
    experience_id: experienceId,
    session_key: sessionKey,
    event: e.event,
    slide_ref: e.slideRef ?? null,
    value: e.value ?? null,
  }));

  const { error } = await admin.from("analytics_events").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, gravel: false, count: rows.length });
}
