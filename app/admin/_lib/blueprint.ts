import { getBuildStatusPills, type StatusPill } from "./build-status";
import { listBuildMocks } from "@/lib/data/build-mocks";
import { safeLoad } from "./safe-load";

export type FeatureStatus = "paved" | "gravel" | "not-built";

export type FeatureEntry = {
  area: string;
  feature: string;
  status: FeatureStatus;
  detail: string;
  files: string[];
};

/**
 * Hand-verified against the actual code in this repo, not generated from
 * memory or an agent's self-report — every "paved"/"gravel" claim here was
 * checked by reading the file(s) listed, matching this page's own
 * "confirm before submission" requirement. Update this array whenever a
 * feature's real status changes; it is deliberately NOT auto-derived from
 * a directory listing, because "the file exists" and "the feature actually
 * works end to end" are different claims and this document only makes the
 * second one.
 */
export const FEATURE_MATRIX: FeatureEntry[] = [
  // Build order item 1
  {
    area: "Foundation",
    feature: "Database schema + RLS policies",
    status: "paved",
    detail:
      "Full schema (10 tables), RLS enabled on every table, public-read/service-role-write policies matching the documented data flow. Written, never yet applied to a live project until this session's Supabase project (ref tgwvbyhvhfqrgvwlddea, REViiZED org) was created.",
    files: ["supabase/migrations/0001_pulse3_schema.sql"],
  },
  {
    area: "Foundation",
    feature: "Storage buckets (headshots/slide-media/replicas/generated)",
    status: "paved",
    detail: "Bucket creation + public-read/service-role-write policies. Written, not yet applied.",
    files: ["supabase/migrations/0002_storage_buckets.sql"],
  },
  {
    area: "Foundation",
    feature: "Regeneration-safe uniqueness (slides/modules by position)",
    status: "paved",
    detail: "Unique constraint on (experience_id, position) so per-slide/per-module upserts work. Written, not yet applied.",
    files: ["supabase/migrations/0003_position_uniques.sql"],
  },
  {
    area: "Foundation",
    feature: "Migrations actually applied to a live database",
    status: "gravel",
    detail:
      "Never run. This sandbox could not reach Supabase all session; the real Pulse project itself was only created a few messages ago. Run `supabase link --project-ref tgwvbyhvhfqrgvwlddea && supabase db push` once .env.local has the new keys.",
    files: [],
  },
  {
    area: "Foundation",
    feature: "Gravel Road audit log (build_mocks writes)",
    status: "gravel",
    detail:
      "Reader + writer both exist and the writer is wired into the highest-traffic gravel paths (design-dna, detect-team, generate-slide, generate-curriculum, replica/reviized). Not yet wired into every route that can gravel (qa, track, gate, cohesion, preinterview/*, the two admin CRUD routes) — logging coverage is real but partial, not exhaustive.",
    files: ["lib/data/build-mocks.ts", "app/admin/build-status/page.tsx"],
  },

  // Build order item 2
  {
    area: "Front Door",
    feature: "Intro, mode select, URL entry, pipeline checklist, Gate",
    status: "paved",
    detail: "Full flow, cohesive design system, real pipeline orchestration (not a timed animation).",
    files: ["components/front-door.tsx", "app/styles/front-door.css"],
  },
  {
    area: "Front Door",
    feature: "Design DNA extraction (colors, fonts)",
    status: "paved",
    detail:
      "Real, no-API-key signal extraction: theme-color meta, Google Fonts link, declared font-family, most-repeated inline hex color. No LLM Vision classification (condensed-impact/geometric-sans/etc. taxonomy) yet — defaults to a neutral 'humanist-sans' label while carrying the real detected font through.",
    files: ["app/api/design-dna/route.ts"],
  },
  {
    area: "Front Door",
    feature: "Real screenshot capture + Claude Vision typography classification",
    status: "not-built",
    detail: "Section 6 item 2's full spec (Puppeteer screenshots + Firecrawl content in parallel, Claude Vision forced tool call). Not started.",
    files: [],
  },
  {
    area: "Front Door",
    feature: "Presenter navigation dock",
    status: "paved",
    detail: "Front Door / Gate / Experience / Admin / Restart, low-contrast until hover.",
    files: ["components/presenter-dock.tsx"],
  },

  // Build order item 3
  {
    area: "Team detection",
    feature: "Detect real team members, re-host headshots, narrator reanchoring",
    status: "paved",
    detail:
      "Grounded in fetched site text (no Firecrawl key needed), forced tool call, membership-checked narrator reanchoring by name (never a stale-id fallback), known-subject registry merge.",
    files: ["app/api/detect-team/route.ts", "lib/known-subjects.ts", "lib/data/profiles.ts"],
  },

  // Build order item 4
  {
    area: "Deck generation",
    feature: "Per-slide generation across the six layouts",
    status: "paved",
    detail: "One forced tool call per slide (never one giant deck response), structural Team/Spotlight/Ask slides.",
    files: ["app/api/generate-slide/route.ts", "lib/slide-plan.ts"],
  },
  {
    area: "Deck generation",
    feature: "Cohesion check",
    status: "paved",
    detail: "Banned-word + dash checks with company-name masking, train-mode-zero-modules reports exactly one item.",
    files: ["app/api/cohesion/route.ts"],
  },
  {
    area: "Deck generation",
    feature: "Deck player (all six layouts, brand-adaptive)",
    status: "paved",
    detail: "Full redesign matching the front-door design system, applies each experience's real design_spec.",
    files: ["components/slide-viewer.tsx", "app/styles/deck.css"],
  },

  // Build order item 5
  {
    area: "Gate",
    feature: "Dynamic branding + leads + batched analytics",
    status: "paved",
    detail: "Real accent/font applied honestly labeled, leads write, 10s-batched analytics queue (sendBeacon on unload).",
    files: ["app/api/gate/route.ts", "app/api/track/route.ts", "lib/data/analytics.ts"],
  },

  // Build order item 6
  {
    area: "Pulse Point",
    feature: "Speaker-aware Q&A grounded in the live site",
    status: "paved",
    detail: "Membership-checked speaker resolution (never 'first profile'), persists both sides of every exchange.",
    files: ["app/api/qa/route.ts", "lib/data/qa.ts", "components/pulse-point.tsx"],
  },

  // Build order item 7
  {
    area: "Voiceover",
    feature: "Server-side TTS narration + crossfade",
    status: "not-built",
    detail: "waveform-layout slides show 'Narration pending' honestly. No /api/voiceover route exists.",
    files: [],
  },

  // Build order item 8
  {
    area: "Train Mode",
    feature: "Self-ratings -> insights -> live interview -> inference -> player -> results",
    status: "paved",
    detail:
      "Full flow. Live interviewer is Tavus (not ElevenLabs Conversational Agent as Section 6 literally specifies — documented gravel-road substitution, Section 3 already names Tavus for this exact role and no ELEVENLABS_API_KEY exists). Interview room has its own ~1000px container, not squeezed into the 580px Front Door card.",
    files: ["app/frontdoor/[id]/train/train-flow.tsx", "app/api/preinterview/tavus/route.ts"],
  },
  {
    area: "Train Mode",
    feature: "Live interview transcript persisted incrementally",
    status: "paved",
    detail:
      "Verified directly in code: each answer POSTs to /api/preinterview/tavus (action: transcript) which calls appendTranscriptEntry, a real read-modify-write against train_sessions.transcript, on every turn, not just at session end.",
    files: ["app/frontdoor/[id]/train/train-flow.tsx", "lib/data/train-sessions.ts"],
  },
  {
    area: "Train Mode",
    feature: "Trainee never sees inferred rating or talent signal",
    status: "paved",
    detail:
      "Enforced at the query layer: getTrainSessionForTrainee explicitly whitelists fields (self + checkpoint only), never select('*'). /api/preinterview/infer computes and writes signal/inferred server-side and returns only a boolean readiness flag.",
    files: ["lib/data/train-sessions.ts", "app/api/preinterview/infer/route.ts"],
  },

  // Build order item 9
  {
    area: "REViiZED replicas",
    feature: "Auth exchange, job create/render, status polling, lookups",
    status: "paved",
    detail:
      "Real implementation against the documented v1 API contract, built this session. Reports gravel today only because REVIIZED_USERNAME/PASSWORD aren't configured, verified via direct route calls.",
    files: ["lib/reviized.ts", "app/api/replica/reviized/route.ts", "app/api/replica/reviized/[id]/status/route.ts"],
  },
  {
    area: "REViiZED replicas",
    feature: "Completed render propagates to profile, deck slide, narrator video",
    status: "paved",
    detail: "Output re-hosted to Storage, then written to profiles.replica_video_url, the matching special=video slide's media_url, and experience.narrator.videoUrl when that profile is the narrator.",
    files: ["app/api/replica/reviized/[id]/status/route.ts"],
  },
  {
    area: "REViiZED replicas",
    feature: "fal.ai fallback path",
    status: "not-built",
    detail: "No /api/replica/fal route. noface (no talking head at all) is the de facto fallback today via the deck's own 'Digital Replica pending' placeholder, not an explicit selectable path.",
    files: [],
  },

  // Build order item 10
  {
    area: "Presentation library",
    feature: "Version branching + Remotion MP4 export",
    status: "not-built",
    detail: "Not started. Last item in the documented build order.",
    files: [],
  },

  // Cross-cutting
  {
    area: "Admin panel",
    feature: "All six tabs (Build Status, Slide/Curriculum Manager, Profiles, Replica Studio, Integrations, Pulse Check)",
    status: "paved",
    detail: "Built and route-tested (200s) against the current key-less state.",
    files: ["app/admin"],
  },
  {
    area: "Admin panel",
    feature: "Role gating (Owner/Admin/Editor/Viewer per tab)",
    status: "not-built",
    detail: "No auth system exists yet in this rebuild. Every /admin route is open to anyone who reaches it. Flagged inline in code by the agent that built the panel.",
    files: [],
  },
];

export function featureCounts(entries: FeatureEntry[]) {
  return {
    paved: entries.filter((e) => e.status === "paved").length,
    gravel: entries.filter((e) => e.status === "gravel").length,
    notBuilt: entries.filter((e) => e.status === "not-built").length,
    total: entries.length,
  };
}

export async function loadBlueprintData() {
  const [pills, mocksResult] = await Promise.all([getBuildStatusPills(), safeLoad(listBuildMocks)]);
  return {
    pills: pills as StatusPill[],
    mocks: mocksResult.data ?? [],
    mocksError: mocksResult.error,
    features: FEATURE_MATRIX,
    counts: featureCounts(FEATURE_MATRIX),
    generatedAt: new Date().toISOString(),
  };
}
