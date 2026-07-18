import { getExperience } from "@/lib/data/experiences";
import { listProfilesForExperience } from "@/lib/data/profiles";
import { listReplicaJobsForExperience } from "@/lib/data/replica-jobs";
import type { ReplicaJob } from "@/types/database";
import { EmptyExperienceState } from "../_components/EmptyExperienceState";
import { DataUnavailable } from "../_components/DataUnavailable";
import { safeLoad } from "../_lib/safe-load";
import { ReplicaEditorList } from "./_ReplicaEditor";

export const dynamic = "force-dynamic";

export default async function ReplicaStudioPage({
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

  const jobs = await listReplicaJobsForExperience(profiles.map((p) => p.id));

  const jobsByProfile: Record<string, ReplicaJob[]> = {};
  for (const job of jobs) {
    if (!job.profile_id) continue;
    (jobsByProfile[job.profile_id] ??= []).push(job);
  }

  return (
    <div>
      <div className="pa-eyebrow">Replica Studio</div>
      <h1 className="pa-h1">{experience.company_name ?? experience.source_url}</h1>
      <p className="pa-lede">
        Owner/Admin only per Section 5&apos;s role gating. Note: this build has no auth/role
        system wired up yet, so real role gating is a known gap, this page is unrestricted for
        now, the same as every other Admin tab, gravel road on the RLS-only role check documented
        in migration 0001.
      </p>

      <ReplicaEditorList profiles={profiles} jobsByProfile={jobsByProfile} />
    </div>
  );
}
