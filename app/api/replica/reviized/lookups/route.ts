import { NextResponse } from "next/server";
import { getLookups, ReviizedUnavailable, ReviizedApiError } from "@/lib/reviized";
import { logBuildMock } from "@/lib/data/build-mocks";

/**
 * Section 7's "Supporting lookups (call once, cache)" — backs Replica
 * Studio's project/video/voice selectors. When REVIIZED_USERNAME/PASSWORD
 * aren't configured, or the call itself fails, returns gravel with empty
 * lists so the UI can fall back to the documented free-text pre-lookup
 * stand-in rather than rendering broken empty dropdowns.
 */
export async function GET() {
  try {
    const lookups = await getLookups();
    return NextResponse.json({ success: true, gravel: false, ...lookups });
  } catch (err) {
    const reason =
      err instanceof ReviizedUnavailable || err instanceof ReviizedApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "REViiZED lookups failed";
    // Only log real API failures here, not "not configured" — this route is
    // fetched on every Replica Studio page load and the no-creds case is
    // already well represented in the log via the other REViiZED routes.
    if (err instanceof ReviizedApiError) await logBuildMock("replica/reviized/lookups", "gravel", reason);
    return NextResponse.json({ success: true, gravel: true, reason, projects: [], videos: [], voices: [] });
  }
}
