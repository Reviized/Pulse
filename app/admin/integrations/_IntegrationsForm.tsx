"use client";

import { useState } from "react";
import type { Experience, ExperienceMode, ReplicaPath } from "@/types/database";
import { updateExperienceMode, updatePilotMode, updateReplicaPath } from "../_actions/integrations";

const REPLICA_PATHS: ReplicaPath[] = ["reviized", "fal", "noface"];
const MODES: ExperienceMode[] = ["inform", "train", "sell"];

export function IntegrationsForm({ experience }: { experience: Experience }) {
  const [pilotMode, setPilotMode] = useState(experience.pilot_mode);
  const [replicaPath, setReplicaPath] = useState(experience.replica_path);
  const [mode, setMode] = useState(experience.mode);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function togglePilot() {
    const next = !pilotMode;
    setPilotMode(next);
    setBusy(true);
    const result = await updatePilotMode(experience.id, next);
    setBusy(false);
    setMessage(
      result.success ? { text: "pilot mode saved", ok: true } : { text: result.reason ?? "save failed", ok: false }
    );
  }

  async function changeReplicaPath(next: ReplicaPath) {
    setReplicaPath(next);
    setBusy(true);
    const result = await updateReplicaPath(experience.id, next);
    setBusy(false);
    setMessage(
      result.success ? { text: "replica path saved", ok: true } : { text: result.reason ?? "save failed", ok: false }
    );
  }

  async function changeMode(next: ExperienceMode) {
    setMode(next);
    setBusy(true);
    const result = await updateExperienceMode(experience.id, next);
    setBusy(false);
    setMessage(
      result.success ? { text: "mode saved (content not migrated, regenerate in Slide/Curriculum Manager)", ok: true } : { text: result.reason ?? "save failed", ok: false }
    );
  }

  return (
    <div className="pa-card">
      <div className="pa-field">
        <label>Source URL</label>
        <div className="pa-json-block">{experience.source_url}</div>
      </div>

      <div className="pa-field">
        <label>Pilot Mode</label>
        <div className="pa-toggle">
          <button
            type="button"
            className={`pa-toggle-switch ${pilotMode ? "on" : ""}`}
            onClick={togglePilot}
            disabled={busy}
            aria-label="Toggle pilot mode"
          >
            <span className="knob" />
          </button>
          <span className="pa-hint" style={{ marginTop: 0 }}>
            {pilotMode ? "On, Prototype Mode defaults apply (Section 4)" : "Off"}
          </span>
        </div>
      </div>

      <div className="pa-grid cols-2">
        <div className="pa-field">
          <label>Replica path</label>
          <select
            className="pa-select"
            value={replicaPath}
            onChange={(e) => changeReplicaPath(e.target.value as ReplicaPath)}
            disabled={busy}
          >
            {REPLICA_PATHS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="pa-field">
          <label>Mode</label>
          <select
            className="pa-select"
            value={mode}
            onChange={(e) => changeMode(e.target.value as ExperienceMode)}
            disabled={busy}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && <div className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</div>}
    </div>
  );
}
