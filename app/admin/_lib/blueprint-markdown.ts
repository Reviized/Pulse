import type { BuildMock } from "@/types/database";
import type { StatusPill } from "./build-status";
import type { FeatureEntry } from "./blueprint";

type BlueprintData = {
  pills: StatusPill[];
  mocks: BuildMock[];
  mocksError: string | null;
  features: FeatureEntry[];
  counts: { paved: number; gravel: number; notBuilt: number; total: number };
  generatedAt: string;
};

const STATUS_LABEL: Record<string, string> = { paved: "PAVED", gravel: "GRAVEL", "not-built": "NOT BUILT" };

/**
 * The single source of truth for the Blueprint's downloadable Markdown —
 * the page renders this same `data` object, so what's on screen and what
 * downloads are guaranteed to agree (no separate copy to drift).
 */
export function generateBlueprintMarkdown(data: BlueprintData): string {
  const lines: string[] = [];
  const p = (s = "") => lines.push(s);

  p(`# Pulse 3.0 — System Blueprint`);
  p();
  p(`Generated ${data.generatedAt}`);
  p();
  p(`## What Pulse 3.0 is`);
  p();
  p(
    `Pulse 3.0 turns any company's public website URL into a scroll-based, interactive, fully branded experience in three modes: Inform, Train, and Sell. Pulse scrapes the site, extracts its design DNA (colors, typography, heading case, button shape) and its real leadership team, then generates a slide experience delivered by that company's own people as Digital Replicas, with a persistent conversational icon (the Pulse Point) answering questions grounded in the live site. Product brand: REViiZED and the Pulse team only.`
  );
  p();
  p(`## Locked terminology`);
  p();
  p(
    `Digital Replicas (never "avatars"), Pulse Point (never "chat bubble" or "bot"), The Gate (email + access code), Pulse Check (analytics dashboard), The Stitch (final pipeline assembly), The Intelligence Loop (the analysis pipeline), Replica Studio (Admin's replica-scripting surface), Gravel Road (any feature stubbed with labeled mock data), Slide (never "frame"). The word "AI" is banned from user-facing copy except a company's own name written exactly as it writes it.`
  );
  p();

  p(`## Live capability matrix`);
  p();
  p(`${data.counts.paved} paved · ${data.counts.gravel} gravel · ${data.counts.notBuilt} not built · ${data.counts.total} tracked features.`);
  p();
  p(`| Area | Feature | Status | Detail |`);
  p(`|---|---|---|---|`);
  for (const f of data.features) {
    p(`| ${f.area} | ${f.feature} | ${STATUS_LABEL[f.status]} | ${f.detail.replace(/\|/g, "/")} |`);
  }
  p();

  p(`## Environment / credential status`);
  p();
  p(`Computed live at generation time, not a hardcoded list.`);
  p();
  p(`| Integration | Status | Reason |`);
  p(`|---|---|---|`);
  for (const pill of data.pills) {
    p(`| ${pill.feature} | ${pill.status.toUpperCase()} | ${pill.reason.replace(/\|/g, "/")} |`);
  }
  p();

  p(`## Gravel Road audit log (build_mocks)`);
  p();
  if (data.mocksError) {
    p(`Could not load: ${data.mocksError}`);
  } else if (data.mocks.length === 0) {
    p(`No rows yet in this environment.`);
  } else {
    p(`| Feature | Status | Note | Logged at |`);
    p(`|---|---|---|---|`);
    for (const m of data.mocks) {
      p(`| ${m.feature} | ${m.status} | ${(m.note ?? "").replace(/\|/g, "/")} | ${m.updated_at} |`);
    }
  }
  p();

  p(`## New developer / new agent onboarding`);
  p();
  p(`1. Clone the repo, checkout the working branch, \`npm install\`.`);
  p(`2. Copy \`.env.example\` to \`.env.local\`. Required for anything live: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY. Optional (gravel-safe without them): TAVUS_API_KEY, TAVUS_PAL_ID, REVIIZED_USERNAME, REVIIZED_PASSWORD, FIRECRAWL_API_KEY, ELEVENLABS_API_KEY, FAL_KEY.`);
  p(`3. \`supabase login && supabase link --project-ref <ref> && supabase db push\` — applies all three migrations in supabase/migrations/.`);
  p(`4. \`npm run dev\`, open localhost:3000, check /admin/build-status first — every pill there is a live check, it tells you exactly what's configured.`);
  p(`5. Read CLAUDE.md for the gravel-road philosophy and locked terminology before changing anything. Every route in app/api degrades to a labeled {gravel:true, reason} response instead of throwing when a credential is missing — match that pattern for new routes.`);
  p(`6. This document (app/admin/_lib/blueprint.ts's FEATURE_MATRIX) is hand-maintained, not auto-generated from a directory scan. Update it when a feature's real status changes.`);
  p();

  p(`## Known gaps, prioritized`);
  p();
  const gaps = data.features.filter((f) => f.status !== "paved");
  for (const g of gaps) {
    p(`- **${g.feature}** (${g.area}, ${STATUS_LABEL[g.status]}): ${g.detail}`);
  }
  p();

  return lines.join("\n");
}
