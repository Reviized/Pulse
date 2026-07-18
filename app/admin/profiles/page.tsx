import { getExperience } from "@/lib/data/experiences";
import { listProfilesForExperience } from "@/lib/data/profiles";
import { EmptyExperienceState } from "../_components/EmptyExperienceState";
import { DataUnavailable } from "../_components/DataUnavailable";
import { safeLoad } from "../_lib/safe-load";
import { ProfileEditorList } from "./_ProfileEditor";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({
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

  return (
    <div>
      <div className="pa-eyebrow">Profiles</div>
      <h1 className="pa-h1">{experience.company_name ?? experience.source_url}</h1>
      <p className="pa-lede">
        Detected leadership and Pulse team members for this experience, in display order. Click an
        avatar to upload a new headshot (re-hosted to the headshots bucket, never hotlinked, per
        Section 5).
      </p>

      <ProfileEditorList
        experienceId={experienceId}
        workspaceId={experience.workspace_id}
        initialProfiles={profilesResult.data ?? []}
      />
    </div>
  );
}
