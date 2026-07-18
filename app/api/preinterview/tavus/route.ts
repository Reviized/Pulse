import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrainSessionRaw, updateTrainSession, appendTranscriptEntry } from "@/lib/data/train-sessions";

/**
 * LIVE INTERVIEW MECHANISM — gravel-road deviation from the master prompt,
 * logged here per the project's "pick the default, note it, move on" rule:
 *
 * The master prompt's Section 6 items 7-8 describe an ElevenLabs
 * Conversational Agent for the live Train pre-interview. This repo has no
 * ELEVENLABS_API_KEY configured (only NEXT_PUBLIC_VANCE_AGENT_ID, an agent
 * id with no server-side key to drive it), but it does have a real
 * TAVUS_API_KEY, and Section 3 of the same document already names
 * "Tavus: video interviewer face for the Train pre-interview only" as the
 * intended integration. So this route drives Tavus instead, ported from the
 * previously-built and tested `tavus-proxy` Supabase edge function (see
 * git history: 4ef7c817, 2e9c155, 8b4ec05) into a real Next.js API route,
 * since this rebuild has no Supabase edge functions and all orchestration
 * goes through Next.js API routes (Section 3). `train_sessions.eleven_conversation_id`
 * now holds the Tavus conversation id for this build (still a plain string
 * column, just repurposed) — see the column comment in the schema.
 *
 * Real Tavus API contract used below (https://docs.tavus.io):
 *   POST https://tavusapi.com/v2/conversations
 *     headers: { "x-api-key": TAVUS_API_KEY, "Content-Type": "application/json" }
 *     body: { persona_id, conversation_name, conversational_context, custom_greeting }
 *     -> { conversation_id, conversation_url, status, ... }
 *   POST https://tavusapi.com/v2/conversations/{conversation_id}/end
 *     headers: { "x-api-key": TAVUS_API_KEY }
 *   GET https://tavusapi.com/v2/conversations/{conversation_id}?verbose=true
 *     headers: { "x-api-key": TAVUS_API_KEY }
 *     -> conversation detail, best-effort perception/transcript data
 *
 * `persona_id` defaults to `pd887940ca78` when TAVUS_PAL_ID is unset, matching
 * .env.example's documented default (env var is named PAL_ID for historical
 * reasons from the prototype; the actual Tavus API field is `persona_id`).
 * No TAVUS_REPLICA_ID is configured, so the persona's own default replica is
 * used — this is the reasonable default given what's in .env.local today.
 *
 * TRANSCRIPT: Tavus's hosted iframe is a sealed conversation UI — this
 * server has no turn-by-turn access to what's said inside it. Rather than
 * fake a "real transcript" we don't actually have, the trainee-facing room
 * (built in app/frontdoor/[id]/train) runs the 4 generated questions as a
 * parallel structured Q&A alongside the Tavus video pane (mic-to-text via
 * the browser's SpeechRecognition where available, typed fallback
 * otherwise), and this route's "transcript" action persists each answer to
 * `train_sessions.transcript` as it happens, per Section 6 item 7 ("not
 * just at the end"). The "get" action still fetches Tavus's own
 * verbose conversation data best-effort for logging/future perception-layer
 * use, matching the prototype's `applyTavusObjectives` caveat that the
 * exact shape of Tavus's extracted-objective data hasn't been confirmed
 * against a live call.
 */

const TAVUS_BASE = "https://tavusapi.com/v2/conversations";
const DEFAULT_PAL_ID = "pd887940ca78";

type Body = {
  action?: "create" | "end" | "get" | "transcript";
  trainSessionId?: string;
  conversationId?: string;
  entry?: { q: string; a: string };
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const action = body?.action;
  const trainSessionId = typeof body?.trainSessionId === "string" ? body.trainSessionId : "";

  if (action === "transcript") {
    if (!trainSessionId || !body?.entry?.q) {
      return NextResponse.json({ error: "trainSessionId and entry are required" }, { status: 400 });
    }
    try {
      await appendTranscriptEntry(trainSessionId, { q: body.entry.q, a: body.entry.a ?? "" });
      return NextResponse.json({ success: true });
    } catch {
      // Never block the interview UI on a transient persistence failure —
      // the client keeps its own in-memory transcript and will send the
      // full set again at "end".
      return NextResponse.json({ success: true, gravel: true, reason: "transcript entry not persisted" });
    }
  }

  if (action === "create") {
    if (!trainSessionId) return NextResponse.json({ error: "trainSessionId is required" }, { status: 400 });
    const apiKey = process.env.TAVUS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: true, gravel: true, reason: "TAVUS_API_KEY not configured" });
    }

    const admin = createAdminClient();
    const session = admin ? await getTrainSessionRaw(trainSessionId) : null;
    if (!session) {
      return NextResponse.json({ success: true, gravel: true, reason: "train session not found" });
    }
    const { data: experience } = admin
      ? await admin.from("experiences").select("company_name, narrator").eq("id", session.experience_id).maybeSingle()
      : { data: null };
    const companyName = experience?.company_name ?? "this company";
    const narratorName = (experience?.narrator as { preferredName?: string } | null)?.preferredName;

    const questions = session.pre_interview_questions ?? [];
    const conversationalContext =
      `You are interviewing a new trainee at ${companyName} before their training begins. ` +
      `Ask these questions, one at a time, in this order, and let them answer fully before moving on: ` +
      questions.map((q, i) => `${i + 1}) ${q}`).join(" ");
    const customGreeting = narratorName
      ? `Hi, I'm glad we get a few minutes to talk before your training starts.`
      : `Hi, thanks for taking a few minutes to talk before your training starts.`;

    try {
      const res = await fetch(TAVUS_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          persona_id: process.env.TAVUS_PAL_ID || DEFAULT_PAL_ID,
          conversation_name: `pulse-train-${trainSessionId}`,
          conversational_context: conversationalContext.slice(0, 2000),
          custom_greeting: customGreeting,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json({ success: true, gravel: true, reason: `Tavus ${res.status}: ${errText.slice(0, 200)}` });
      }
      const data = (await res.json()) as { conversation_id?: string; conversation_url?: string };
      if (!data.conversation_url || !data.conversation_id) {
        return NextResponse.json({ success: true, gravel: true, reason: "Tavus response missing conversation_url" });
      }
      await updateTrainSession(trainSessionId, { eleven_conversation_id: data.conversation_id });
      return NextResponse.json({
        success: true,
        gravel: false,
        conversationUrl: data.conversation_url,
        conversationId: data.conversation_id,
      });
    } catch (err) {
      return NextResponse.json({
        success: true,
        gravel: true,
        reason: err instanceof Error ? err.message : "Tavus request failed",
      });
    }
  }

  if (action === "end") {
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const apiKey = process.env.TAVUS_API_KEY;
    if (!apiKey || !conversationId) {
      return NextResponse.json({ success: true, gravel: true, reason: "missing TAVUS_API_KEY or conversationId" });
    }
    try {
      await fetch(`${TAVUS_BASE}/${conversationId}/end`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // best-effort only — never block the trainee's flow on Tavus teardown
    }
    return NextResponse.json({ success: true });
  }

  if (action === "get") {
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const apiKey = process.env.TAVUS_API_KEY;
    if (!apiKey || !conversationId) {
      return NextResponse.json({ success: true, gravel: true, reason: "missing TAVUS_API_KEY or conversationId" });
    }
    try {
      const res = await fetch(`${TAVUS_BASE}/${conversationId}?verbose=true`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return NextResponse.json({ success: true, gravel: true, reason: `Tavus ${res.status}` });
      const data = await res.json();
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return NextResponse.json({ success: true, gravel: true, reason: err instanceof Error ? err.message : "Tavus get failed" });
    }
  }

  return NextResponse.json({ error: "unknown or missing action" }, { status: 400 });
}
