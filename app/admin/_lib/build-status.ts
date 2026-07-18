import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "./safe-load";

export type StatusPill = {
  feature: string;
  status: "paved" | "gravel";
  reason: string;
};

/**
 * Section 4: "The Admin panel Build Status page computes paved/gravel from
 * actual state ... never from a hardcoded list." Every pill below is a real
 * check performed at request time — an env var Boolean() read or a live
 * Supabase query — never a static value.
 */
export async function getBuildStatusPills(): Promise<StatusPill[]> {
  const pills: StatusPill[] = [];

  // Supabase connectivity: prefer the service-role client (what every write
  // path in this app actually uses per Section 5's RLS rules); fall back to
  // the anon client so connectivity is still reported honestly even when
  // SUPABASE_SERVICE_ROLE_KEY isn't set yet — that's a separate pill below.
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.from("experiences").select("id").limit(1);
    pills.push(
      error
        ? { feature: "Supabase connectivity", status: "gravel", reason: `service-role query failed: ${error.message}` }
        : { feature: "Supabase connectivity", status: "paved", reason: "select id from experiences limit 1 succeeded via the service-role client" }
    );
  } else {
    try {
      const anon = createClient();
      const { error } = await anon.from("experiences").select("id").limit(1);
      pills.push(
        error
          ? { feature: "Supabase connectivity", status: "gravel", reason: `anon query failed: ${error.message}` }
          : { feature: "Supabase connectivity", status: "paved", reason: "select id from experiences limit 1 succeeded via the anon client (no service role key to test with)" }
      );
    } catch (err) {
      pills.push({
        feature: "Supabase connectivity",
        status: "gravel",
        reason: errorMessage(err),
      });
    }
  }

  pills.push({
    feature: "SUPABASE_SERVICE_ROLE_KEY",
    status: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? "present — every service-role write path (slides, profiles, training_modules, ...) is live"
      : "not set — every write helper in lib/data and lib/supabase/admin.ts returns null/[] gracefully instead of writing",
  });

  pills.push({
    feature: "ANTHROPIC_API_KEY",
    status: Boolean(process.env.ANTHROPIC_API_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.ANTHROPIC_API_KEY)
      ? "present — forced tool call generation (detect-team, generate-slide, generate-curriculum) is live"
      : "not set — lib/anthropic.ts throws AnthropicUnavailable, generation routes fall back to labeled stub content",
  });

  pills.push({
    feature: "TAVUS_API_KEY",
    status: Boolean(process.env.TAVUS_API_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.TAVUS_API_KEY)
      ? "present — Train mode's pre-interview video interviewer face (Section 3) is available"
      : "not set — Train mode pre-interview has no interviewer face configured",
  });

  const reviizedConfigured = Boolean(process.env.REVIIZED_USERNAME) && Boolean(process.env.REVIIZED_PASSWORD);
  pills.push({
    feature: "REVIIZED_USERNAME / REVIIZED_PASSWORD",
    status: reviizedConfigured ? "paved" : "gravel",
    reason: reviizedConfigured
      ? "both present — server-side JWT exchange against the real REViiZED API can be attempted"
      : "not set — this is the expected gravel road (Section 7): Replica Studio renders free-text project/video/voice id fields as the pre-lookup stand-in, and POST /api/replica/reviized short-circuits to a gravel result",
  });

  pills.push({
    feature: "FIRECRAWL_API_KEY",
    status: Boolean(process.env.FIRECRAWL_API_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.FIRECRAWL_API_KEY)
      ? "present — content extraction for /api/scrape can use Firecrawl"
      : "not set — /api/scrape has no Firecrawl content extraction path configured",
  });

  pills.push({
    feature: "ELEVENLABS_API_KEY",
    status: Boolean(process.env.ELEVENLABS_API_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.ELEVENLABS_API_KEY)
      ? "present — voiceover, the Conversational Agent interview, and Conversation Analysis are available"
      : "not set — /api/voiceover, the live pre-interview session, and Conversation Analysis have no ElevenLabs path configured",
  });

  pills.push({
    feature: "FAL_KEY",
    status: Boolean(process.env.FAL_KEY) ? "paved" : "gravel",
    reason: Boolean(process.env.FAL_KEY)
      ? "present — the fal.ai talking-head fallback path (fal-ai/heygen/avatar4/image-to-video) is available"
      : "not set — the fal.ai fallback replica path is not configured; noface remains the always-available minimum",
  });

  return pills;
}
