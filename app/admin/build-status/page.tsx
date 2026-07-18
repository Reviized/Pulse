import { getBuildStatusPills } from "../_lib/build-status";
import { listBuildMocks } from "@/lib/data/build-mocks";
import { safeLoad } from "../_lib/safe-load";
import { Pill } from "../_components/Pill";

export const dynamic = "force-dynamic";

export default async function BuildStatusPage() {
  const [pills, mocksResult] = await Promise.all([getBuildStatusPills(), safeLoad(listBuildMocks)]);
  const mocks = mocksResult.data ?? [];
  const pavedCount = pills.filter((p) => p.status === "paved").length;

  return (
    <div>
      <div className="pa-eyebrow">Build Status</div>
      <h1 className="pa-h1">
        {pavedCount} of {pills.length} integrations paved
      </h1>
      <p className="pa-lede">
        Every pill below is computed live on this page load, an env var Boolean() read or a real
        Supabase query, never a hardcoded list (Section 4). REViiZED reporting gravel here is
        expected in this environment: no REVIIZED_USERNAME/PASSWORD are configured.
      </p>

      <div className="pa-card" style={{ padding: 0 }}>
        {pills.map((p) => (
          <div className="pa-status-row" key={p.feature}>
            <div>
              <div className="pa-status-feature">{p.feature}</div>
              <div className="pa-status-reason">{p.reason}</div>
            </div>
            <Pill status={p.status}>{p.status}</Pill>
          </div>
        ))}
      </div>

      <div className="pa-section-title">Gravel Road log (build_mocks)</div>
      <p className="pa-lede" style={{ marginBottom: 14 }}>
        Every mock fallback across the app logs a row here (Section 4: &quot;All mock usage is
        logged to a build_mocks table&quot;).
      </p>
      {mocksResult.error ? (
        <div className="pa-empty" style={{ borderColor: "rgba(217,122,122,.4)", color: "var(--bad)" }}>
          Could not load build_mocks: {mocksResult.error}
        </div>
      ) : mocks.length === 0 ? (
        <div className="pa-empty">
          No build_mocks rows yet, nothing has fallen back to a mock and been logged in this
          environment.
        </div>
      ) : (
        <div className="pa-card" style={{ padding: 0 }}>
          {mocks.map((m) => (
            <div className="pa-mock-row" key={m.id}>
              <span className="pa-mock-feature">{m.feature}</span>
              <Pill status={m.status}>{m.status}</Pill>
              <span className="pa-mock-note">{m.note ?? ""}</span>
              <span className="pa-mock-time">{new Date(m.updated_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
