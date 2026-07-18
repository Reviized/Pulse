import { loadBlueprintData } from "../_lib/blueprint";
import { generateBlueprintMarkdown } from "../_lib/blueprint-markdown";
import { Pill } from "../_components/Pill";
import { BlueprintActions } from "./_BlueprintActions";
import type { FeatureStatus } from "../_lib/blueprint";

export const dynamic = "force-dynamic";

function pillStatus(s: FeatureStatus): "paved" | "gravel" | "bad" {
  if (s === "paved") return "paved";
  if (s === "gravel") return "gravel";
  return "bad";
}

const STATUS_LABEL: Record<FeatureStatus, string> = { paved: "paved", gravel: "gravel", "not-built": "not built" };

export default async function BlueprintPage() {
  const data = await loadBlueprintData();
  const markdown = generateBlueprintMarkdown(data);
  const areas = Array.from(new Set(data.features.map((f) => f.area)));

  return (
    <div>
      <div className="pa-eyebrow">System Blueprint</div>
      <h1 className="pa-h1">
        {data.counts.paved} of {data.counts.total} tracked features paved
      </h1>
      <p className="pa-lede">
        Generated live at {new Date(data.generatedAt).toLocaleString()}. Every row below was verified against the
        actual code in this repo, not inferred from memory or an agent&apos;s own report — this is the same
        &quot;computed live, never hardcoded&quot; rule Build Status runs on, applied to the whole system instead of
        just credentials. Detailed enough that a new developer or a fresh agent could pick this project up from
        here.
      </p>

      <BlueprintActions markdown={markdown} />

      <div className="pa-section-title">What Pulse 3.0 is</div>
      <p className="pa-lede">
        Pulse 3.0 turns any company&apos;s public website URL into a scroll-based, interactive, fully branded
        experience in three modes: Inform, Train, and Sell. Pulse scrapes the site, extracts its design DNA and its
        real leadership team, then generates a slide experience delivered by that company&apos;s own people as
        Digital Replicas, with a persistent conversational icon (the Pulse Point) answering questions grounded in
        the live site. Product brand: REViiZED and the Pulse team only.
      </p>

      <div className="pa-section-title">Live capability matrix</div>
      {areas.map((area) => (
        <div key={area} style={{ marginBottom: 22 }}>
          <div className="pa-item-meta" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>
            {area}
          </div>
          <div className="pa-card" style={{ padding: 0 }}>
            {data.features
              .filter((f) => f.area === area)
              .map((f) => (
                <div className="pa-status-row" key={f.feature}>
                  <div>
                    <div className="pa-status-feature">{f.feature}</div>
                    <div className="pa-status-reason">{f.detail}</div>
                    {f.files.length > 0 && (
                      <div className="pa-status-reason" style={{ opacity: 0.6, marginTop: 2 }}>
                        {f.files.join(", ")}
                      </div>
                    )}
                  </div>
                  <Pill status={pillStatus(f.status)}>{STATUS_LABEL[f.status]}</Pill>
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="pa-section-title">Environment / credential status</div>
      <p className="pa-lede">Same live check as the Build Status tab, repeated here for a single-document view.</p>
      <div className="pa-card" style={{ padding: 0 }}>
        {data.pills.map((p) => (
          <div className="pa-status-row" key={p.feature}>
            <div>
              <div className="pa-status-feature">{p.feature}</div>
              <div className="pa-status-reason">{p.reason}</div>
            </div>
            <Pill status={p.status}>{p.status}</Pill>
          </div>
        ))}
      </div>

      <div className="pa-section-title">Gravel Road audit log (build_mocks)</div>
      {data.mocksError ? (
        <div className="pa-empty" style={{ borderColor: "rgba(217,122,122,.4)", color: "var(--bad)" }}>
          Could not load build_mocks: {data.mocksError}
        </div>
      ) : data.mocks.length === 0 ? (
        <div className="pa-empty">No build_mocks rows yet in this environment.</div>
      ) : (
        <div className="pa-card" style={{ padding: 0 }}>
          {data.mocks.map((m) => (
            <div className="pa-mock-row" key={m.id}>
              <span className="pa-mock-feature">{m.feature}</span>
              <Pill status={m.status}>{m.status}</Pill>
              <span className="pa-mock-note">{m.note ?? ""}</span>
              <span className="pa-mock-time">{new Date(m.updated_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pa-section-title">Train Mode: transcripts and trainee safety, verified</div>
      <p className="pa-lede">
        Two things this build must never get wrong, confirmed directly in code for this report: (1) every interview
        answer is written to <code>train_sessions.transcript</code> the moment it&apos;s given, via a real
        read-modify-write in <code>lib/data/train-sessions.ts</code>&apos;s <code>appendTranscriptEntry</code>, not
        batched at the end where a dropped connection could lose it. (2) the trainee-facing read path,{" "}
        <code>getTrainSessionForTrainee</code>, explicitly whitelists only self-ratings and checkpoint pass/fail —
        the inferred talent rating and signal are computed and stored server-side in{" "}
        <code>/api/preinterview/infer</code> and never appear in any response a trainee&apos;s browser receives.
      </p>

      <div className="pa-section-title">New developer / new agent onboarding</div>
      <ol className="pa-lede" style={{ paddingLeft: 20 }}>
        <li>Clone the repo, checkout the working branch, run <code>npm install</code>.</li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code>. Required for anything live:{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>ANTHROPIC_API_KEY</code>.
        </li>
        <li>
          <code>supabase login &amp;&amp; supabase link --project-ref &lt;ref&gt; &amp;&amp; supabase db push</code>{" "}
          applies all three migrations.
        </li>
        <li>
          <code>npm run dev</code>, open the app, check <code>/admin/build-status</code> first, every pill there is a
          live check.
        </li>
        <li>
          Read <code>CLAUDE.md</code> before changing anything: the gravel-road philosophy and locked terminology
          apply to every future change, not just this build.
        </li>
      </ol>

      <div className="pa-section-title">Known gaps, prioritized</div>
      <div className="pa-card" style={{ padding: 0 }}>
        {data.features
          .filter((f) => f.status !== "paved")
          .map((f) => (
            <div className="pa-status-row" key={f.feature}>
              <div>
                <div className="pa-status-feature">
                  {f.feature} <span style={{ opacity: 0.55 }}>· {f.area}</span>
                </div>
                <div className="pa-status-reason">{f.detail}</div>
              </div>
              <Pill status={pillStatus(f.status)}>{STATUS_LABEL[f.status]}</Pill>
            </div>
          ))}
      </div>
    </div>
  );
}
