"use client";

import { useRef, useState } from "react";
import type { Profile, ProfileRole } from "@/types/database";
import { uploadProfileHeadshot } from "../_actions/media";
import { createProfile, deleteProfile, updateProfile, type ProfileFormFields } from "../_actions/profiles";

const ROLES: ProfileRole[] = ["Owner", "Admin", "Editor", "Viewer"];

function toForm(p: Profile): ProfileFormFields {
  return {
    name: p.name,
    title: p.title ?? "",
    bio: p.bio ?? "",
    role: p.role,
    eleven_voice_id: p.eleven_voice_id ?? "",
    replica_video_url: p.replica_video_url ?? "",
  };
}

const BLANK_FORM: ProfileFormFields = {
  name: "",
  title: "",
  bio: "",
  role: "Viewer",
  eleven_voice_id: "",
  replica_video_url: "",
};

export function ProfileEditorList({
  experienceId,
  workspaceId,
  initialProfiles,
}: {
  experienceId: string;
  workspaceId: string | null;
  initialProfiles: Profile[];
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      {profiles.length === 0 ? (
        <div className="pa-empty">
          No detected team members for this experience yet. Run /api/detect-team from the pipeline,
          or add one manually below.
        </div>
      ) : (
        profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            experienceId={experienceId}
            onUpdated={(updated) => setProfiles((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
            onDeleted={(id) => setProfiles((prev) => prev.filter((x) => x.id !== id))}
          />
        ))
      )}

      <div className="pa-btn-row" style={{ marginTop: 8, marginBottom: 20 }}>
        <button className="pa-btn ghost" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Cancel" : "+ Add profile"}
        </button>
      </div>

      {showNew && (
        <NewProfileForm
          experienceId={experienceId}
          workspaceId={workspaceId}
          onCreated={() => {
            setShowNew(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function NewProfileForm({
  experienceId,
  workspaceId,
  onCreated,
}: {
  experienceId: string;
  workspaceId: string | null;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<ProfileFormFields>(BLANK_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const result = await createProfile(experienceId, workspaceId, form);
    setBusy(false);
    if (result.success) {
      setMessage({ text: "created", ok: true });
      onCreated();
    } else {
      setMessage({ text: result.reason ?? "create failed", ok: false });
    }
  }

  return (
    <div className="pa-card">
      <div className="pa-section-title" style={{ marginTop: 0 }}>
        New profile
      </div>
      <ProfileFields form={form} setForm={setForm} />
      <div className="pa-btn-row">
        <button className="pa-btn" onClick={submit} disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </button>
        {message && <span className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</span>}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  experienceId,
  onUpdated,
  onDeleted,
}: {
  profile: Profile;
  experienceId: string;
  onUpdated: (p: Profile) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<ProfileFormFields>(toForm(profile));
  const [headshotUrl, setHeadshotUrl] = useState(profile.headshot_url);
  const [busy, setBusy] = useState<"idle" | "saving" | "uploading" | "deleting">("idle");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy("saving");
    setMessage(null);
    const result = await updateProfile(profile.id, form);
    setBusy("idle");
    if (result.success) {
      onUpdated({ ...profile, ...form, headshot_url: headshotUrl });
      setMessage({ text: "saved", ok: true });
    } else {
      setMessage({ text: result.reason ?? "save failed", ok: false });
    }
  }

  async function remove() {
    if (!confirm(`Remove ${profile.name}? This does not touch their generated slides/scripts.`)) return;
    setBusy("deleting");
    const result = await deleteProfile(profile.id, experienceId);
    setBusy("idle");
    if (result.success) onDeleted(profile.id);
    else setMessage({ text: result.reason ?? "delete failed", ok: false });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("uploading");
    setMessage(null);
    const fd = new FormData();
    fd.set("headshot", file);
    const result = await uploadProfileHeadshot(profile.id, fd);
    setBusy("idle");
    if (result.success && result.url) {
      setHeadshotUrl(result.url);
      setMessage({ text: "headshot uploaded", ok: true });
    } else {
      setMessage({ text: result.reason ?? "upload failed", ok: false });
    }
  }

  return (
    <div className="pa-item-card">
      <div className="pa-item-body">
        <div className="pa-profile-row">
          <button
            type="button"
            className="pa-avatar-btn"
            onClick={() => fileRef.current?.click()}
            title="Click to upload a new headshot"
          >
            {headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headshotUrl} alt={profile.name} />
            ) : (
              <span className="pa-avatar-mono">
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
            <span className="overlay">{busy === "uploading" ? "Uploading…" : "Change photo"}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleUpload}
          />

          <div className="pa-profile-fields">
            <ProfileFields form={form} setForm={setForm} />
            <div className="pa-btn-row">
              <button className="pa-btn" onClick={save} disabled={busy !== "idle"}>
                {busy === "saving" ? "Saving…" : "Save"}
              </button>
              <button className="pa-btn danger small" onClick={remove} disabled={busy !== "idle"}>
                {busy === "deleting" ? "Removing…" : "Remove"}
              </button>
              {message && (
                <span className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileFields({
  form,
  setForm,
}: {
  form: ProfileFormFields;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormFields>>;
}) {
  return (
    <div className="pa-grid cols-2">
      <div>
        <div className="pa-field">
          <label>Name</label>
          <input className="pa-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="pa-field">
          <label>Title</label>
          <input className="pa-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="pa-field">
          <label>Role</label>
          <select className="pa-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as ProfileFormFields["role"] }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="pa-field">
          <label>Bio</label>
          <textarea className="pa-textarea" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        </div>
        <div className="pa-field">
          <label>ElevenLabs voice ID</label>
          <input
            className="pa-input"
            value={form.eleven_voice_id}
            onChange={(e) => setForm((f) => ({ ...f, eleven_voice_id: e.target.value }))}
            placeholder="e.g. AAD1pHpohWFWNaypAieV"
          />
        </div>
        <div className="pa-field">
          <label>Replica video URL</label>
          <input
            className="pa-input"
            value={form.replica_video_url}
            onChange={(e) => setForm((f) => ({ ...f, replica_video_url: e.target.value }))}
            placeholder="Rendered REViiZED / fal output"
          />
        </div>
      </div>
    </div>
  );
}
