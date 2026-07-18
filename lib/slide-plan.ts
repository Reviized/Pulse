import type { ExperienceMode, Narrator, Profile, SlideLayout, SlideSpecial, SlideTextPos } from "@/types/database";

/**
 * The deck skeleton for Inform/Sell (Section 9): opening video, generated
 * content slides across the six locked layouts, Team, Leader Spotlight
 * (second leader, when there is one), final Ask slide. Isomorphic (no
 * server-only imports) so the Front Door pipeline can build the plan
 * client-side from the profiles detect-team already returned, then walk it
 * one generate-slide call per slot, matching the visible pipeline checklist
 * to real progress instead of a timed animation.
 */
export type SlideSlot = {
  position: number;
  layout: SlideLayout;
  special: SlideSpecial;
  textPos: SlideTextPos;
  speakerProfileId: string | null;
  label: string;
  brief: string;
};

const MODE_BRIEFS: Record<ExperienceMode, { hook: string; core: string; how: string; stats: string; quote: string }> = {
  inform: {
    hook: "A one-line hook introducing who this company is and what they do, written for someone who has never heard of them.",
    core: "What this company actually does, grounded in the real site content, in plain concrete terms.",
    how: "How the company's work or product actually works, step by step, in plain terms.",
    stats: "3 to 4 real or representative numbers that show scale or credibility.",
    quote: "A short, human quote-style line in the founder or team's voice, grounded in the site content.",
  },
  train: {
    hook: "A one-line hook framing what this training will teach and why it matters.",
    core: "The core process or knowledge this training module covers, grounded in the real site content.",
    how: "The concrete steps a trainee needs to follow, in plain terms.",
    stats: "3 to 4 numbers that show why this process matters or what good performance looks like.",
    quote: "A short line of encouragement or context in the trainer's voice.",
  },
  sell: {
    hook: "A one-line hook that opens a pitch, framing the problem this company solves.",
    core: "The core offer or value proposition, grounded in the real site content.",
    how: "How working with this company actually works, step by step, from a buyer's point of view.",
    stats: "3 to 4 numbers that build credibility or urgency for a buyer.",
    quote: "A short, confident line that could close a pitch, in the team's voice.",
  },
};

export function buildSlidePlan(
  mode: ExperienceMode,
  profiles: Profile[],
  narrator: Narrator | null
): SlideSlot[] {
  const briefs = MODE_BRIEFS[mode];
  const narratorId = narrator?.profileId ?? profiles[0]?.id ?? null;
  const spotlight = profiles[1];

  const slots: SlideSlot[] = [
    { position: 0, layout: "media_full", special: "video", textPos: "lower", speakerProfileId: narratorId, label: "Opening", brief: briefs.hook },
    { position: 1, layout: "text_only", special: null, textPos: "center", speakerProfileId: narratorId, label: "Hook", brief: briefs.hook },
    { position: 2, layout: "split", special: null, textPos: "center", speakerProfileId: narratorId, label: "Core", brief: briefs.core },
    { position: 3, layout: "three_quarter", special: null, textPos: "center", speakerProfileId: narratorId, label: "How it works", brief: briefs.how },
    { position: 4, layout: "stats", special: null, textPos: "center", speakerProfileId: narratorId, label: "By the numbers", brief: briefs.stats },
    { position: 5, layout: "waveform", special: null, textPos: "center", speakerProfileId: narratorId, label: "In their words", brief: briefs.quote },
    { position: 6, layout: "text_only", special: "team", textPos: "center", speakerProfileId: null, label: "The Team", brief: "" },
  ];

  let pos = 7;
  if (spotlight) {
    slots.push({ position: pos++, layout: "split", special: "spotlight", textPos: "center", speakerProfileId: spotlight.id, label: "Leader Spotlight", brief: "" });
  }
  slots.push({ position: pos, layout: "text_only", special: "ask", textPos: "center", speakerProfileId: narratorId, label: "Ask", brief: "" });

  return slots;
}
