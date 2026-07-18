import { getExperience, getSlidesForExperience } from "@/lib/data/experiences";
import { listProfilesForExperience } from "@/lib/data/profiles";
import { listModulesForExperience } from "@/lib/data/training";
import type { Slide, TrainingModule } from "@/types/database";
import { EmptyExperienceState } from "../_components/EmptyExperienceState";
import { DataUnavailable } from "../_components/DataUnavailable";
import { safeLoad } from "../_lib/safe-load";
import { SlideEditorList } from "./_SlideEditor";
import { ModuleEditorList } from "./_ModuleEditor";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: { exp?: string };
}) {
  const experienceId = searchParams.exp;
  if (!experienceId) return <EmptyExperienceState />;

  const expResult = await safeLoad(() => getExperience(experienceId));
  if (expResult.error) return <DataUnavailable message={expResult.error} />;
  const experience = expResult.data;
  if (!experience) return <EmptyExperienceState />;

  const profilesResult = await safeLoad(() => listProfilesForExperience(experienceId));
  if (profilesResult.error) return <DataUnavailable message={profilesResult.error} />;
  const profiles = profilesResult.data ?? [];

  const isTrain = experience.mode === "train";
  let modules: TrainingModule[] = [];
  let slides: Slide[] = [];

  if (isTrain) {
    const modulesResult = await safeLoad(() => listModulesForExperience(experienceId));
    if (modulesResult.error) return <DataUnavailable message={modulesResult.error} />;
    modules = modulesResult.data ?? [];
  } else {
    const slidesResult = await safeLoad(() => getSlidesForExperience(experienceId));
    if (slidesResult.error) return <DataUnavailable message={slidesResult.error} />;
    slides = slidesResult.data ?? [];
  }

  return (
    <div>
      <div className="pa-eyebrow">{isTrain ? "Curriculum Manager" : "Slide Manager"}</div>
      <h1 className="pa-h1">{experience.company_name ?? experience.source_url}</h1>
      <p className="pa-lede">
        {isTrain
          ? "Train mode's four-module curriculum. Full parity with Slide Manager: inline edit, per-item speaker assignment, media upload, and regenerate."
          : "The six locked layouts (text_only, media_full, split, three_quarter, stats, waveform), in position order."}
      </p>

      {isTrain ? (
        <ModuleEditorList experienceId={experienceId} initialModules={modules} profiles={profiles} />
      ) : (
        <SlideEditorList experienceId={experienceId} initialSlides={slides} profiles={profiles} />
      )}
    </div>
  );
}
