import type { TrainSessionRating } from "@/types/database";
import type { DwellPoint } from "../_lib/pulse-check-queries";

/**
 * Lightweight inline SVG, per the build spec ("no new chart library
 * dependency" — package.json edits need sign-off this pass can't get
 * autonomously). Single-hue sequential bars for the dwell chart (magnitude,
 * one series); two categorical hues (blue self / gold inferred, already
 * distinct in this product's own palette) plus a reserved status color for
 * the checkpoint pass/fail dot on the delta chart.
 */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export function DwellBarChart({ data }: { data: DwellPoint[] }) {
  if (data.length === 0) {
    return <div className="pa-empty">No dwell events yet, this is real (zero rows), not gravel.</div>;
  }

  const sorted = [...data].sort((a, b) => b.avgValue - a.avgValue).slice(0, 24);
  const max = Math.max(...sorted.map((d) => d.avgValue), 1);
  const rowH = 30;
  const width = 680;
  const labelW = 130;
  const barAreaW = width - labelW - 70;
  const height = sorted.length * rowH + 10;

  return (
    <div className="pa-chart-wrap">
      <svg width={width} height={height} role="img" aria-label="Average dwell time per slide, in seconds">
        {sorted.map((d, i) => {
          const barW = Math.max((d.avgValue / max) * barAreaW, 2);
          const y = i * rowH;
          return (
            <g key={d.slideRef} transform={`translate(0, ${y})`}>
              <title>
                {d.slideRef}: {d.avgValue.toFixed(1)}s average over {d.samples} sample{d.samples === 1 ? "" : "s"}
              </title>
              <text x={labelW - 8} y={rowH / 2 + 4} textAnchor="end" className="pa-bar-label">
                {d.slideRef}
              </text>
              <rect x={labelW} y={4} width={barW} height={rowH - 12} rx={4} fill="var(--gold)" />
              <text x={labelW + barW + 8} y={rowH / 2 + 4} className="pa-bar-value">
                {d.avgValue.toFixed(1)}s
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DeltaChart({
  modules,
  ratings,
}: {
  modules: { id: string; title: string }[];
  ratings: Record<string, TrainSessionRating>;
}) {
  if (modules.length === 0) {
    return <div className="pa-empty">No modules to chart.</div>;
  }

  const rowH = 44;
  const width = 680;
  const labelW = 170;
  const barAreaW = width - labelW - 50;
  const scaleMax = 5;
  const height = modules.length * rowH + 10;

  return (
    <div className="pa-chart-wrap">
      <div style={{ display: "flex", gap: 18, marginBottom: 10, fontSize: 10.5, color: "var(--dim)" }}>
        <LegendDot color="var(--inform)" label="Self rating" />
        <LegendDot color="var(--gold)" label="Inferred rating" />
        <LegendDot color="var(--good)" label="Checkpoint passed" />
        <LegendDot color="var(--bad)" label="Checkpoint failed" />
      </div>
      <svg width={width} height={height} role="img" aria-label="Self versus inferred rating per module">
        {modules.map((m, i) => {
          const r = ratings[m.id];
          const y = i * rowH;
          const selfW = r ? Math.max((r.self / scaleMax) * barAreaW, 2) : 0;
          const inferredW = r?.inferred != null ? Math.max((r.inferred / scaleMax) * barAreaW, 2) : 0;
          return (
            <g key={m.id} transform={`translate(0, ${y})`}>
              <text x={labelW - 26} y={16} textAnchor="end" className="pa-bar-label">
                {m.title}
              </text>
              {r?.checkpoint != null && (
                <circle cx={labelW - 12} cy={18} r={4} fill={r.checkpoint ? "var(--good)" : "var(--bad)"} />
              )}
              {r ? (
                <>
                  <rect x={labelW} y={2} width={selfW} height={13} rx={4} fill="var(--inform)" />
                  <text x={labelW + selfW + 6} y={12} className="pa-bar-value">
                    {r.self}
                  </text>
                  <rect x={labelW} y={20} width={inferredW} height={13} rx={4} fill="var(--gold)" />
                  <text x={labelW + inferredW + 6} y={30} className="pa-bar-value">
                    {r.inferred ?? "–"}
                  </text>
                </>
              ) : (
                <text x={labelW} y={20} className="pa-bar-label">
                  not rated
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
