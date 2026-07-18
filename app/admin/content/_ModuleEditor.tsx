"use client";

import { useState } from "react";
import type { TrainingModule, Profile } from "@/types/database";
import { uploadModuleMedia } from "../_actions/media";

export function ModuleEditorList({
  experienceId,
  initialModules,
  profiles,
}: {
  experienceId: string;
  initialModules: TrainingModule[];
  profiles: Profile[];
}) {
  const [modules, setModules] = useState<TrainingModule[]>(initialModules);
  const [openId, setOpenId] = useState<string | null>(initialModules[0]?.id ?? null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function regenerateCurriculum() {
    setRegenerating(true);
    setRegenMessage(null);
    try {
      const res = await fetch("/api/generate-curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experienceId }),
      });
      const json = await res.json();
      if (json.gravel) {
        setRegenMessage({ text: json.reason ?? "gravel: curriculum regeneration unavailable", ok: false });
      } else if (json.modules) {
        setModules(json.modules);
        setRegenMessage({ text: `regenerated ${json.modules.length} modules`, ok: true });
      } else {
        setRegenMessage({ text: json.error ?? "regenerate failed", ok: false });
      }
    } catch (err) {
      setRegenMessage({ text: err instanceof Error ? err.message : "regenerate failed", ok: false });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <div className="pa-btn-row" style={{ marginBottom: 18 }}>
        <button className="pa-btn" onClick={regenerateCurriculum} disabled={regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate Curriculum"}
        </button>
        <span className="pa-hint">
          Two-phase outline plus per-module generation (Section 6 #5). Regeneration preserves
          attached media, speakers, and scripts by module position.
        </span>
        {regenMessage && (
          <span className={`pa-save-status ${regenMessage.ok ? "ok" : "err"}`}>{regenMessage.text}</span>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="pa-empty">
          No modules yet for this experience. Use Regenerate Curriculum above, or run the Front
          Door pipeline in Train mode.
        </div>
      ) : (
        modules.map((mod, i) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            index={i}
            profiles={profiles}
            open={openId === mod.id}
            onToggle={() => setOpenId((prev) => (prev === mod.id ? null : mod.id))}
            onUpdated={(updated) => setModules((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
          />
        ))
      )}
    </div>
  );
}

function ModuleCard({
  mod,
  index,
  profiles,
  open,
  onToggle,
  onUpdated,
}: {
  mod: TrainingModule;
  index: number;
  profiles: Profile[];
  open: boolean;
  onToggle: () => void;
  onUpdated: (mod: TrainingModule) => void;
}) {
  const [form, setForm] = useState({
    title: mod.title,
    objective: mod.objective,
    script: mod.script ?? "",
    speaker_profile_id: mod.speaker_profile_id ?? "",
  });
  const [busy, setBusy] = useState<"idle" | "saving" | "uploading">("idle");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setBusy("saving");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/modules/${mod.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          objective: form.objective,
          script: form.script,
          speaker_profile_id: form.speaker_profile_id || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage({ text: json.reason ?? json.error ?? "save failed", ok: false });
      } else {
        onUpdated(json.module);
        setMessage({ text: "saved", ok: true });
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "save failed", ok: false });
    } finally {
      setBusy("idle");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("uploading");
    setMessage(null);
    const fd = new FormData();
    fd.set("media", file);
    const result = await uploadModuleMedia(mod.id, fd);
    if (result.success && result.url) {
      onUpdated({ ...mod, media_url: result.url, media_kind: file.type.startsWith("video") ? "video" : "image" });
      setMessage({ text: "uploaded", ok: true });
    } else {
      setMessage({ text: result.reason ?? "upload failed", ok: false });
    }
    setBusy("idle");
    e.target.value = "";
  }

  return (
    <div className="pa-item-card">
      <div className="pa-item-head" onClick={onToggle}>
        <span className="pa-item-pos">{String(index + 1).padStart(2, "0")}</span>
        <span className="pa-item-title">{mod.title || "(untitled module)"}</span>
        <span className="pa-item-meta">{mod.checkpoint ? "checkpoint set" : "no checkpoint"}</span>
      </div>

      {open && (
        <div className="pa-item-body">
          <div className="pa-grid cols-2">
            <div>
              <div className="pa-field">
                <label>Title</label>
                <input
                  className="pa-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Objective</label>
                <textarea
                  className="pa-textarea"
                  value={form.objective}
                  onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Speaker</label>
                <select
                  className="pa-select"
                  value={form.speaker_profile_id}
                  onChange={(e) => setForm((f) => ({ ...f, speaker_profile_id: e.target.value }))}
                >
                  <option value="">No speaker assigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="pa-field">
                <label>Talk-it script</label>
                <textarea
                  className="pa-textarea"
                  value={form.script}
                  onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Media</label>
                {mod.media_url &&
                  (mod.media_kind === "video" ? (
                    <video className="pa-media-preview" src={mod.media_url} controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="pa-media-preview" src={mod.media_url} alt="" />
                  ))}
                <input className="pa-file-input" type="file" accept="image/*,video/*" onChange={handleUpload} />
              </div>
            </div>
          </div>

          {mod.lesson && mod.lesson.length > 0 && (
            <div className="pa-field">
              <label>Lesson (read-only, regenerate curriculum to change)</label>
              <div className="pa-json-block">{mod.lesson.join("\n\n")}</div>
            </div>
          )}
          {mod.key_points && mod.key_points.length > 0 && (
            <div className="pa-field">
              <label>Key points (read-only)</label>
              <div className="pa-json-block">{mod.key_points.map((k) => `• ${k}`).join("\n")}</div>
            </div>
          )}
          {mod.checkpoint && (
            <div className="pa-field">
              <label>Checkpoint (read-only)</label>
              <div className="pa-json-block">
                {mod.checkpoint.q}
                {"\n"}
                {mod.checkpoint.options.map((o, i) => `${i === mod.checkpoint!.correct ? "✓" : "·"} ${o}`).join("\n")}
              </div>
            </div>
          )}

          <div className="pa-btn-row">
            <button className="pa-btn" onClick={save} disabled={busy !== "idle"}>
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
            {busy === "uploading" && <span className="pa-save-status">Uploading…</span>}
            {message && <span className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
