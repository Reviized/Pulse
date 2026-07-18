import { getExperience } from "@/lib/data/experiences";
import { getBuildStatusPills } from "../_lib/build-status";
import { EmptyExperienceState } from "../_components/EmptyExperienceState";
import { DataUnavailable } from "../_components/DataUnavailable";
import { safeLoad } from "../_lib/safe-load";
import { Pill } from "../_components/Pill";
import { IntegrationsForm } from "./_IntegrationsForm";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
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

  const pills = await getBuildStatusPills();

  return (
    <div>
      <div className="pa-eyebrow">Integrations</div>
      <h1 className="pa-h1">{experience.company_name ?? experience.source_url}</h1>
      <p className="pa-lede">Env var presence only, actual secret values are never rendered here.</p>

      <div className="pa-section-title" style={{ marginTop: 0 }}>
        Configured integrations
      </div>
      <div className="pa-card" style={{ padding: 0, marginBottom: 30 }}>
        {pills
          .filter((p) => p.feature !== "Supabase connectivity")
          .map((p) => (
            <div className="pa-status-row" key={p.feature}>
              <div className="pa-status-feature">{p.feature}</div>
              <Pill status={p.status}>{p.status}</Pill>
            </div>
          ))}
      </div>

      <div className="pa-section-title">Narrator configuration (read-only)</div>
      <div className="pa-json-block" style={{ marginBottom: 30 }}>
        {experience.narrator
          ? JSON.stringify(experience.narrator, null, 2)
          : "No narrator configured, falls back to the neutral Pulse Narrator agent."}
      </div>

      <div className="pa-section-title">Experience settings</div>
      <IntegrationsForm experience={experience} />
    </div>
  );
}
