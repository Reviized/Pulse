import { createAdminClient } from "@/lib/supabase/admin";
import type { QaMessageInsert } from "@/types/database";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type QaSpeaker = {
  profileId: string | null;
  name: string;
  title: string;
  bio: string | null;
};

/**
 * The neutral fallback identity (Section 8: "a neutral 'Pulse Narrator'
 * agent, zero personal details"). Never "Pulse Point" itself speaking in
 * first person as a bot — the Pulse Point is the icon, the Pulse Narrator is
 * who answers through it when no real speaker is anchored.
 */
const NEUTRAL_SPEAKER: QaSpeaker = {
  profileId: null,
  name: "Pulse Narrator",
  title: "Pulse Guide",
  bio: null,
};

/**
 * Membership-checked speaker resolution (CLAUDE.md hard-won lesson 4 /
 * Section 8 item 2): a real bug shipped in the prototype when a lookup
 * silently fell back to "the first profile" whenever an id didn't resolve.
 * Here, if speakerProfileId doesn't match a real row scoped to this exact
 * experience, fall through to the neutral Pulse Narrator identity — never
 * guess at a stand-in person.
 */
export async function resolveQaSpeaker(
  admin: AdminClient,
  experienceId: string,
  speakerProfileId: string | null
): Promise<QaSpeaker> {
  if (!speakerProfileId) return NEUTRAL_SPEAKER;

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", speakerProfileId)
    .eq("experience_id", experienceId)
    .maybeSingle();

  if (!profile) return NEUTRAL_SPEAKER;

  return {
    profileId: profile.id,
    name: profile.name,
    title: profile.title ?? "",
    bio: profile.bio,
  };
}

/**
 * Persists both sides of one Pulse Point exchange to qa_messages. Only ever
 * called after a real generated answer exists — the gravel path (no admin
 * client, no Anthropic key) returns before this is reached, so no fake
 * exchange is ever written.
 */
export async function persistQaExchange(
  admin: AdminClient,
  opts: {
    experienceId: string;
    sessionKey: string | null;
    speakerProfileId: string | null;
    question: string;
    answer: string;
  }
): Promise<void> {
  const rows: QaMessageInsert[] = [
    {
      experience_id: opts.experienceId,
      session_key: opts.sessionKey,
      speaker_profile_id: opts.speakerProfileId,
      role: "visitor",
      content: opts.question,
    },
    {
      experience_id: opts.experienceId,
      session_key: opts.sessionKey,
      speaker_profile_id: opts.speakerProfileId,
      role: "replica",
      content: opts.answer,
    },
  ];
  const { error } = await admin.from("qa_messages").insert(rows);
  if (error) {
    // Non-blocking: the visitor already has their answer on screen, a
    // persistence failure here shouldn't surface as a broken Pulse Point.
    console.warn("pulse-qa: failed to persist qa_messages —", error.message);
  }
}
