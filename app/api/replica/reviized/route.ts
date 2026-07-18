import { NextResponse } from "next/server";

/**
 * Section 7's real contract: POST /v1/token/ -> POST /v1/jobs/create/ ->
 * PATCH /v1/jobs/{id}/render/, server-side only, credentials never touching
 * the client. REVIIZED_USERNAME/REVIIZED_PASSWORD are not configured in
 * this environment (confirmed absent from .env.local), so per the gravel
 * road philosophy (Section 4) this reports gravel immediately and never
 * attempts a real call — Replica Studio's "Queue REViiZED job" button still
 * writes a real `replica_jobs` row with status HOLD off this honest result.
 *
 * When REVIIZED_USERNAME/PASSWORD are supplied, pave this: exchange for a
 * JWT (cache in server memory, refresh before the 30-minute expiry), then
 * POST /v1/jobs/create/ with {project, name, script, video, voice} and
 * PATCH /v1/jobs/{id}/render/ with {force}. Respect the 3/minute render cap
 * and the 30/minute overall cap.
 */
export async function POST(req: Request) {
  const username = process.env.REVIIZED_USERNAME;
  const password = process.env.REVIIZED_PASSWORD;

  if (!username || !password) {
    return NextResponse.json({
      success: true,
      gravel: true,
      reason: "REVIIZED_USERNAME/PASSWORD not configured",
    });
  }

  // Credentials are present but the real jobs/create -> jobs/render sequence
  // has not been built against a live account yet in this pass — still an
  // honest gravel result, not a fabricated success, per Section 4.
  const body = await req.json().catch(() => null);
  return NextResponse.json({
    success: true,
    gravel: true,
    reason: "REViiZED credentials are configured but the live job pipeline is not wired yet (build order item 9)",
    payload: body ?? null,
  });
}
