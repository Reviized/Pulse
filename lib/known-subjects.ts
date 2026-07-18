/**
 * Known-subject registry (Section 8, item 4): real people Pulse already has
 * production-ready assets for. Merge is additive and name-gated only — it
 * fills in a field the live scrape came up empty for, it never overrides a
 * real value the scrape found, and it never hardcodes a company override.
 */
export type KnownSubject = {
  matchNames: string[]; // lowercased match tokens, first+last
  eleven_voice_id?: string;
  headshot_url?: string;
};

export const KNOWN_SUBJECTS: KnownSubject[] = [
  {
    matchNames: ["brad vier"],
    eleven_voice_id: "AAD1pHpohWFWNaypAieV",
  },
  {
    matchNames: ["ross coffman"],
  },
];

export function findKnownSubject(name: string): KnownSubject | undefined {
  const norm = name.trim().toLowerCase();
  return KNOWN_SUBJECTS.find((s) => s.matchNames.some((m) => m === norm));
}
