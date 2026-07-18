import { NextResponse } from "next/server";
import { createJob, renderJob, ReviizedUnavailable, ReviizedApiError } from "@/lib/reviized";

/**
 * Section 7's real contract: POST /v1/jobs/create/ -> PATCH
 * /v1/jobs/{id}/render/, server-side only via lib/reviized.ts (the JWT
 * exchange never touches the client). Requires project/video/voice as
 * REViiZED's own numeric catalog ids (Section 7's lookups, see
 * /api/replica/reviized/lookups) plus a script and a display name.
 *
 * REVIIZED_USERNAME/PASSWORD absent -> honest gravel, no call attempted.
 * A validation gap in the payload itself (missing project/video/voice)
 * also gravels rather than sending a call REViiZED would just reject.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const project = typeof body?.project === "number" ? body.project : null;
  const video = typeof body?.video === "number" ? body.video : null;
  const voice = typeof body?.voice === "number" ? body.voice : null;
  const name = typeof body?.name === "string" ? body.name : "";
  const script = typeof body?.script === "string" ? body.script : "";

  if (!project || !video || !voice || !name || !script.trim()) {
    return NextResponse.json({
      success: true,
      gravel: true,
      reason: "project, video, voice, name, and a non-empty script are all required before REViiZED can queue this",
    });
  }

  try {
    const job = await createJob({ project, name, script, video, voice, notes: body?.notes });
    await renderJob(job.id);

    // The reviized_job_id lives on replica_jobs (Section 5's schema has no
    // such column on profiles) — the caller (queueReviizedJob server
    // action) writes it there via insertReplicaJob right after this call.
    return NextResponse.json({ success: true, gravel: false, reviizedJobId: job.id, status: job.status ?? "REQUESTED" });
  } catch (err) {
    if (err instanceof ReviizedUnavailable) {
      return NextResponse.json({ success: true, gravel: true, reason: err.message });
    }
    if (err instanceof ReviizedApiError) {
      return NextResponse.json({ success: true, gravel: true, reason: err.message, status: err.status });
    }
    return NextResponse.json({
      success: true,
      gravel: true,
      reason: err instanceof Error ? err.message : "REViiZED job creation failed",
    });
  }
}
