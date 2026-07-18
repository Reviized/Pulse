"use client";

import { useState } from "react";
import type { Profile, ReplicaJob, ReplicaJobStatus } from "@/types/database";
import { queueReviizedJob, updateReplicaFields, type ReplicaFormFields } from "../_actions/replica";
import { Pill } from "../_components/Pill";

function statusPillKind(status: ReplicaJobStatus): "paved" | "gravel" | "bad" {
  if (status === "COMPLETE") return "paved";
  if (status === "ERROR") return "bad";
  return "gravel";
}

export function ReplicaEditorList({
  profiles,
  jobsByProfile,
}: {
  profiles: Profile[];
  jobsByProfile: Record<string, ReplicaJob[]>;
}) {
  if (profiles.length === 0) {
    return (
      <div className="pa-empty">
        No detected profiles for this experience yet. Replica Studio scripts and queues jobs per
        profile, so run team detection first.
      </div>
    );
  }

  return (
    <div>
      {profiles.map((p) => (
        <ReplicaCard key={p.id} profile={p} jobs={jobsByProfile[p.id] ?? []} />
      ))}
    </div>
  );
}

function ReplicaCard({ profile, jobs }: { profile: Profile; jobs: ReplicaJob[] }) {
  const [form, setForm] = useState<ReplicaFormFields>({
    replica_script: profile.replica_script ?? "",
    reviized_project_id: profile.reviized_project_id?.toString() ?? "",
    reviized_video_id: profile.reviized_video_id?.toString() ?? "",
    reviized_voice_id: profile.reviized_voice_id?.toString() ?? "",
  });
  const [jobHistory, setJobHistory] = useState(jobs);
  const [busy, setBusy] = useState<"idle" | "saving" | "queueing">("idle");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setBusy("saving");
    setMessage(null);
    const result = await updateReplicaFields(profile.id, form);
    setBusy("idle");
    setMessage(
      result.success
        ? { text: "saved", ok: true }
        : { text: result.reason ?? "save failed", ok: false }
    );
  }

  async function queue() {
    setBusy("queueing");
    setMessage(null);
    const result = await queueReviizedJob(profile.id);
    setBusy("idle");
    if (!result.success) {
      setMessage({ text: result.reason ?? "queue failed", ok: false });
      return;
    }
    setMessage({
      text: result.gravel ? `HOLD: ${result.reason}` : `queued, status ${result.jobStatus}`,
      ok: !result.gravel,
    });
    if (result.jobId) {
      setJobHistory((prev) => [
        {
          id: result.jobId!,
          profile_id: profile.id,
          reviized_job_id: null,
          payload: {
            project: form.reviized_project_id ? Number(form.reviized_project_id) : null,
            name: profile.name,
            script: form.replica_script,
            video: form.reviized_video_id ? Number(form.reviized_video_id) : null,
            voice: form.reviized_voice_id ? Number(form.reviized_voice_id) : null,
            notes: result.reason,
          },
          status: result.jobStatus ?? "HOLD",
          output_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  }

  return (
    <div className="pa-item-card">
      <div className="pa-item-body">
        <div className="pa-item-title" style={{ marginBottom: 14 }}>
          {profile.name}
          <span className="pa-item-meta" style={{ marginLeft: 10 }}>
            {profile.title ?? ""}
          </span>
        </div>

        <div className="pa-field">
          <label>Script (persists to profiles.replica_script)</label>
          <textarea
            className="pa-textarea"
            value={form.replica_script}
            onChange={(e) => setForm((f) => ({ ...f, replica_script: e.target.value }))}
            placeholder={`What ${profile.name}'s Digital Replica currently says…`}
          />
        </div>

        <p className="pa-hint gravel-note">
          Gravel road: REViiZED lookups not wired, no account credentials configured. These are
          free-text ID fields, the pre-lookup stand-in (Section 7) — once REVIIZED_USERNAME /
          REVIIZED_PASSWORD are set, this becomes three lookup-backed selectors populated from
          GET /v1/projects, /v1/videos, and /v1/voices.
        </p>

        <div className="pa-grid cols-3">
          <div className="pa-field">
            <label>REViiZED project id</label>
            <input
              className="pa-input"
              value={form.reviized_project_id}
              onChange={(e) => setForm((f) => ({ ...f, reviized_project_id: e.target.value }))}
              placeholder="int"
            />
          </div>
          <div className="pa-field">
            <label>REViiZED video id</label>
            <input
              className="pa-input"
              value={form.reviized_video_id}
              onChange={(e) => setForm((f) => ({ ...f, reviized_video_id: e.target.value }))}
              placeholder="int"
            />
          </div>
          <div className="pa-field">
            <label>REViiZED voice id</label>
            <input
              className="pa-input"
              value={form.reviized_voice_id}
              onChange={(e) => setForm((f) => ({ ...f, reviized_voice_id: e.target.value }))}
              placeholder="int"
            />
          </div>
        </div>

        <div className="pa-btn-row">
          <button className="pa-btn ghost" onClick={save} disabled={busy !== "idle"}>
            {busy === "saving" ? "Saving…" : "Save script and ids"}
          </button>
          <button className="pa-btn" onClick={queue} disabled={busy !== "idle"}>
            {busy === "queueing" ? "Queueing…" : "Queue REViiZED job"}
          </button>
          {message && <span className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</span>}
        </div>

        {jobHistory.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {jobHistory.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Pill status={statusPillKind(j.status)}>{j.status}</Pill>
                    </td>
                    <td>{j.payload.notes ?? ""}</td>
                    <td>{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
