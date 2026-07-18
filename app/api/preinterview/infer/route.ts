import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forcedToolCall, AnthropicUnavailable } from "@/lib/anthropic";
import { getTrainSessionRaw, updateTrainSession } from "@/lib/data/train-sessions";
import type { TrainSessionRating } from "@/types/database";

const INFER_TOOL = {
  name: "infer_module_ratings",
  description:
    "For each training module (given in order), infers a 1-5 talent rating from the trainee's self-rating and live interview transcript, weighing the transcript more heavily than the self-rating, plus a one-sentence internal note.",
  input_schema: {
    type: "object",
    properties: {
      inferences: {
        type: "array",
        description: "One entry per module, in the exact order the modules were given.",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "0-based index matching the module order given." },
            inferred: { type: "integer", minimum: 1, maximum: 5 },
            note: { type: "string", description: "One sentence, internal talent-intelligence note, never shown to the trainee." },
          },
          required: ["index", "inferred", "note"],
        },
      },
    },
    required: ["inferences"],
  },
};

/**
 * RLS RULE (non-negotiable, master prompt Section 5): this route's response
 * to the client must never include inferred ratings or `signal` — those are
 * Owner/Admin read-only, in the UI and in any API response addressed to the
 * trainee. This route computes them, writes them to train_sessions via the
 * admin client, and returns only a boolean readiness flag. If you're adding
 * a field to this response, it must not come from `ratings[].inferred`,
 * `ratings[].note`, or `signal` — see lib/data/train-sessions.ts's
 * getTrainSessionForTrainee for the one sanctioned trainee-facing read path.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const trainSessionId = typeof body?.trainSessionId === "string" ? body.trainSessionId : "";
  if (!trainSessionId) return NextResponse.json({ error: "trainSessionId is required" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ success: true, gravel: true, routeReady: false, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  const session = await getTrainSessionRaw(trainSessionId);
  if (!session) return NextResponse.json({ error: "train session not found" }, { status: 404 });

  const { data: modules } = await admin
    .from("training_modules")
    .select("id, position, title, objective")
    .eq("experience_id", session.experience_id)
    .order("position", { ascending: true });
  const moduleList = modules ?? [];
  if (moduleList.length === 0) {
    return NextResponse.json({ success: true, gravel: true, routeReady: false, reason: "no training modules for this experience" });
  }

  const transcriptText = (session.transcript ?? []).map((t, i) => `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a}`).join("\n\n");
  const selfSummary = moduleList
    .map((m, i) => `${i}) ${m.title} — self-rating ${session.ratings?.[m.id]?.self ?? "unrated"} / 5 (objective: ${m.objective})`)
    .join("\n");

  let inferences: { index: number; inferred: number; note: string }[] | null = null;
  let gravel = false;
  let reason: string | undefined;

  try {
    const result = await forcedToolCall<{ inferences: { index: number; inferred: number; note: string }[] }>({
      system:
        "You are the talent-intelligence layer for a training platform. Infer each module's real rating from the trainee's live interview transcript, weighing the transcript far more heavily than their self-rating — never simply copy the self-rating. If the transcript shows more or less understanding than the self-rating claims, trust the transcript. These notes and ratings are Owner/Admin eyes only and are never shown to the trainee. No em or en dashes.",
      user: `Modules (index — title — self-rating — objective):\n${selfSummary}\n\nLive interview transcript:\n${transcriptText || "(no transcript captured)"}`,
      tool: INFER_TOOL,
      maxTokens: 1200,
    });
    inferences = result.inferences;
  } catch (err) {
    gravel = true;
    reason = err instanceof AnthropicUnavailable ? "ANTHROPIC_API_KEY not configured" : "inference failed";
  }

  const ratings: Record<string, TrainSessionRating> = { ...session.ratings };
  moduleList.forEach((m, i) => {
    const existing = ratings[m.id] ?? { self: 3, inferred: null, checkpoint: null, note: null };
    const found = inferences?.find((inf) => inf.index === i);
    if (found) {
      ratings[m.id] = {
        ...existing,
        inferred: Math.min(5, Math.max(1, Math.round(found.inferred))),
        note: found.note,
      };
    } else {
      // Gravel fallback: no live inference available, mirror the self-rating
      // and label it plainly so an Admin reviewing Pulse Check knows this
      // session's signal isn't real inference (Section 4: "mock it, label it").
      ratings[m.id] = {
        ...existing,
        inferred: existing.self,
        note: reason ? `gravel: ${reason}, inferred mirrors self-rating` : "gravel: inference unavailable, inferred mirrors self-rating",
      };
    }
  });

  const routeOrder = [...moduleList]
    .sort((a, b) => (ratings[a.id]?.inferred ?? 3) - (ratings[b.id]?.inferred ?? 3))
    .map((m) => m.id);

  const avg = (key: "self" | "inferred") =>
    moduleList.reduce((sum, m) => sum + (Number(ratings[m.id]?.[key]) || 0), 0) / moduleList.length;
  const weakest = moduleList.find((m) => m.id === routeOrder[0]);
  const strongest = moduleList.find((m) => m.id === routeOrder[routeOrder.length - 1]);
  const signal = gravel
    ? `gravel: ${reason} — signal is a self-rating mirror, not real inference.`
    : `Self-avg ${avg("self").toFixed(1)} vs inferred-avg ${avg("inferred").toFixed(1)}. Weakest: ${weakest?.title ?? "n/a"}. Strongest: ${strongest?.title ?? "n/a"}.`;

  await updateTrainSession(trainSessionId, { ratings, route_order: routeOrder, signal });

  return NextResponse.json({ success: true, gravel, routeReady: true });
}
