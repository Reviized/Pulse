import { notFound, redirect } from "next/navigation";
import { getExperience, getSlidesForExperience } from "@/lib/data/experiences";
import { listProfilesForExperience } from "@/lib/data/profiles";
import { listModulesForExperience } from "@/lib/data/training";
import { SlideViewer, DeckEmptyState } from "@/components/slide-viewer";
import type { Experience, Profile, Slide, TrainingModule } from "@/types/database";

export const dynamic = "force-dynamic";

const UNREACHABLE_REASON =
  "This experience couldn't be loaded right now, the database connection isn't reachable. Try again in a moment.";

export default async function FrontDoorPage({
  params,
}: {
  params: { id: string };
}) {
  // CLAUDE.md: "every external API call gets try/catch with a graceful mock
  // fallback... never crash the page." The read helpers in lib/data/* throw
  // on a Supabase error rather than swallowing it (reasonable for a Server
  // Component that can catch at the boundary), so that boundary belongs
  // here: a genuinely unreachable database becomes an honest gravel message
  // instead of Next's raw 500, distinct from a real "no such experience".
  let experience: Experience | null;
  try {
    experience = await getExperience(params.id);
  } catch (err) {
    console.warn("pulse-frontdoor: could not reach the database —", err);
    return <DeckEmptyState reason={UNREACHABLE_REASON} />;
  }
  if (!experience) notFound();

  if (experience.mode === "train") {
    // Section 9: "Jumping to Experience in Train mode with a curriculum but
    // no active session routes into the pre-interview ... with no
    // curriculum at all, routes home." Train Mode's player and pre-interview
    // live under their own route (app/frontdoor/[id]/train/**), owned by
    // another agent per CLAUDE.md's file-scope split — not built here.
    let modules: TrainingModule[];
    try {
      modules = await listModulesForExperience(experience.id);
    } catch (err) {
      console.warn("pulse-frontdoor: could not reach the database —", err);
      return <DeckEmptyState mode={experience.mode} companyName={experience.company_name} reason={UNREACHABLE_REASON} />;
    }
    if (modules.length === 0) {
      return (
        <DeckEmptyState
          mode={experience.mode}
          companyName={experience.company_name}
          reason="This experience's curriculum hasn't been generated yet. Run it again from the Front Door to build it."
        />
      );
    }
    // Forward to the Train Mode route regardless of whether it has landed
    // yet, the same gravel-road pattern the presenter dock uses for Admin:
    // link now, land later, never block on build order.
    redirect(`/frontdoor/${experience.id}/train`);
  }

  let slides: Slide[];
  let profiles: Profile[];
  try {
    [slides, profiles] = await Promise.all([
      getSlidesForExperience(experience.id),
      listProfilesForExperience(experience.id),
    ]);
  } catch (err) {
    console.warn("pulse-frontdoor: could not reach the database —", err);
    return <DeckEmptyState mode={experience.mode} companyName={experience.company_name} reason={UNREACHABLE_REASON} />;
  }

  if (slides.length === 0) {
    // Section 9: "Jumping to Experience with no generated content redirects
    // to the Front Door with a clear message, never an empty deck." The
    // real build's Front Door is a single in-memory state machine that can
    // display a passed-in message directly; this one lives at a separate
    // route (components/front-door.tsx, out of this file's scope) that
    // doesn't currently read a query-string notice. Rather than silently
    // bounce to "/" and lose the explanation, render the message inline
    // here with an explicit link back, which is the honest reading of
    // "never an empty deck" without touching another agent's file.
    return (
      <DeckEmptyState
        mode={experience.mode}
        companyName={experience.company_name}
        reason="This experience doesn't have any generated slides yet. Run it again from the Front Door to build the deck."
      />
    );
  }

  return <SlideViewer experience={experience} slides={slides} profiles={profiles} />;
}
