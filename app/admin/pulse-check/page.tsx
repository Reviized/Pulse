import { getExperience } from "@/lib/data/experiences";
import { listLeadsForExperience } from "@/lib/data/leads";
import { listModulesForExperience } from "@/lib/data/training";
import type { TrainingModule } from "@/types/database";
import { EmptyExperienceState } from "../_components/EmptyExperienceState";
import { DataUnavailable } from "../_components/DataUnavailable";
import { safeLoad } from "../_lib/safe-load";
import { getDwellBySlide, getExperienceTiles, getTrainSessionsForExperience } from "../_lib/pulse-check-queries";
import { DeltaChart, DwellBarChart } from "./_charts";

export const dynamic = "force-dynamic";

export default async function PulseCheckPage({
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

  // getExperienceTiles / getDwellBySlide / listLeadsForExperience /
  // getTrainSessionsForExperience are all admin-client-backed (Section 5:
  // these tables have no public-select policy) and already degrade to an
  // honest empty result instead of throwing when Supabase is unreachable or
  // the service-role key isn't configured — no safeLoad needed for those.
  const [tiles, dwell, leads] = await Promise.all([
    getExperienceTiles(experienceId),
    getDwellBySlide(experienceId),
    listLeadsForExperience(experienceId),
  ]);

  const isTrain = experience.mode === "train";
  let modules: TrainingModule[] = [];
  const sessions = isTrain ? await getTrainSessionsForExperience(experienceId) : [];
  if (isTrain) {
    const modulesResult = await safeLoad(() => listModulesForExperience(experienceId));
    modules = modulesResult.data ?? [];
  }

  return (
    <div>
      <div className="pa-eyebrow">Pulse Check</div>
      <h1 className="pa-h1">{experience.company_name ?? experience.source_url}</h1>
      <p className="pa-lede">
        Real queries against analytics_events, leads
        {isTrain ? ", and train_sessions" : ""}. A zero here means zero rows came back, that&apos;s
        a real empty state, not a gravel placeholder (Section 9).
      </p>

      <div className="pa-grid cols-4" style={{ marginBottom: 32 }}>
        <div className="pa-tile">
          <div className="num">{tiles.views}</div>
          <div className="label">Views</div>
        </div>
        <div className="pa-tile">
          <div className="num">{tiles.completes}</div>
          <div className="label">Completes</div>
        </div>
        <div className="pa-tile">
          <div className="num">{tiles.leads}</div>
          <div className="label">Leads</div>
        </div>
        <div className="pa-tile">
          <div className="num">{tiles.ppOpens}</div>
          <div className="label">Pulse Point opens</div>
        </div>
      </div>

      <div className="pa-section-title" style={{ marginTop: 0 }}>
        Dwell per slide (avg seconds)
      </div>
      <div className="pa-card" style={{ marginBottom: 32 }}>
        <DwellBarChart data={dwell} />
      </div>

      <div className="pa-section-title">Leads</div>
      {leads.length === 0 ? (
        <div className="pa-empty">No leads yet.</div>
      ) : (
        <div className="pa-card" style={{ padding: 0, marginBottom: 32 }}>
          <table className="pa-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Unlocked</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.email}</td>
                  <td>{new Date(l.unlocked_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isTrain && (
        <>
          <div className="pa-section-title">Training Intelligence</div>
          <p className="pa-lede">
            Per-trainee self vs inferred delta and the computed talent signal. Owner/Admin eyes
            only per Section 5&apos;s RLS rules — train_sessions.signal and .transcript never
            reach a trainee-facing response (enforced in the API layer, migration 0001 also locks
            row visibility to the service role), which is exactly why this lives only on this
            Admin surface and nowhere in the trainee-facing player.
          </p>
          {sessions.length === 0 ? (
            <div className="pa-empty">No sessions yet.</div>
          ) : (
            sessions.map((s) => (
              <div className="pa-item-card" key={s.id}>
                <div className="pa-item-body">
                  <div className="pa-item-title" style={{ marginBottom: 4 }}>
                    {s.trainee_email}
                  </div>
                  <div className="pa-item-meta" style={{ marginBottom: 14 }}>
                    {s.completed_at ? `completed ${new Date(s.completed_at).toLocaleString()}` : "in progress"}
                  </div>

                  <DeltaChart modules={modules.map((m) => ({ id: m.id, title: m.title }))} ratings={s.ratings} />

                  <div className="pa-field" style={{ marginTop: 14 }}>
                    <label>Talent signal</label>
                    <div className="pa-json-block">
                      {s.signal ?? "Not yet inferred, /api/preinterview/infer has not run for this session."}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
