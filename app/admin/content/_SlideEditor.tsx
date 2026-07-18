"use client";

import { useState } from "react";
import type { Slide, Profile } from "@/types/database";
import { uploadSlideMedia } from "../_actions/media";

type SlideFormState = {
  eyebrow: string;
  headline: string;
  body: string;
  sig: string;
  script: string;
  speaker_profile_id: string;
  brief: string;
};

function toForm(s: Slide): SlideFormState {
  return {
    eyebrow: s.eyebrow ?? "",
    headline: s.headline ?? "",
    body: s.body ?? "",
    sig: s.sig ?? "",
    script: s.script ?? "",
    speaker_profile_id: s.speaker_profile_id ?? "",
    brief: "",
  };
}

export function SlideEditorList({
  experienceId,
  initialSlides,
  profiles,
}: {
  experienceId: string;
  initialSlides: Slide[];
  profiles: Profile[];
}) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [openId, setOpenId] = useState<string | null>(initialSlides[0]?.id ?? null);

  if (slides.length === 0) {
    return (
      <div className="pa-empty">
        No slides yet for this experience. Run the Front Door pipeline (GO) to generate them
        first, they will appear here in position order.
      </div>
    );
  }

  return (
    <div>
      {slides.map((slide, i) => (
        <SlideCard
          key={slide.id}
          slide={slide}
          index={i}
          profiles={profiles}
          experienceId={experienceId}
          open={openId === slide.id}
          onToggle={() => setOpenId((prev) => (prev === slide.id ? null : slide.id))}
          onUpdated={(updated) =>
            setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          }
        />
      ))}
    </div>
  );
}

function SlideCard({
  slide,
  index,
  profiles,
  experienceId,
  open,
  onToggle,
  onUpdated,
}: {
  slide: Slide;
  index: number;
  profiles: Profile[];
  experienceId: string;
  open: boolean;
  onToggle: () => void;
  onUpdated: (slide: Slide) => void;
}) {
  const [form, setForm] = useState<SlideFormState>(toForm(slide));
  const [busy, setBusy] = useState<"idle" | "saving" | "regenerating" | "uploading">("idle");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setBusy("saving");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/slides/${slide.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eyebrow: form.eyebrow,
          headline: form.headline,
          body: form.body,
          sig: form.sig,
          script: form.script,
          speaker_profile_id: form.speaker_profile_id || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage({ text: json.reason ?? json.error ?? "save failed", ok: false });
      } else {
        onUpdated(json.slide);
        setMessage({ text: "saved", ok: true });
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "save failed", ok: false });
    } finally {
      setBusy("idle");
    }
  }

  async function regenerate() {
    setBusy("regenerating");
    setMessage(null);
    try {
      const res = await fetch("/api/generate-slide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          experienceId,
          position: slide.position,
          layout: slide.layout,
          special: slide.special,
          textPos: slide.text_pos,
          speakerProfileId: form.speaker_profile_id || null,
          brief: form.brief,
          label: slide.label,
        }),
      });
      const json = await res.json();
      if (json.gravel) {
        setMessage({ text: json.reason ?? "gravel: regeneration unavailable", ok: false });
      } else if (json.slide) {
        onUpdated(json.slide);
        setForm(toForm(json.slide));
        setMessage({ text: "regenerated", ok: true });
      } else {
        setMessage({ text: json.error ?? "regenerate failed", ok: false });
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "regenerate failed", ok: false });
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
    const result = await uploadSlideMedia(slide.id, fd);
    if (result.success && result.url) {
      onUpdated({
        ...slide,
        media_url: result.url,
        media_kind: file.type.startsWith("video") ? "video" : "image",
      });
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
        <span className="pa-item-title">{slide.headline || slide.label || "(untitled slide)"}</span>
        <span className="pa-item-meta">
          {slide.layout}
          {slide.special ? ` · ${slide.special}` : ""}
        </span>
      </div>

      {open && (
        <div className="pa-item-body">
          <div className="pa-grid cols-2">
            <div>
              <div className="pa-field">
                <label>Eyebrow</label>
                <input
                  className="pa-input"
                  value={form.eyebrow}
                  onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Headline</label>
                <input
                  className="pa-input"
                  value={form.headline}
                  onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Sig</label>
                <input
                  className="pa-input"
                  value={form.sig}
                  onChange={(e) => setForm((f) => ({ ...f, sig: e.target.value }))}
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
                <label>Body</label>
                <textarea
                  className="pa-textarea"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div className="pa-field">
                <label>Talk-it script</label>
                <textarea
                  className="pa-textarea"
                  value={form.script}
                  onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="pa-field">
            <label>Media</label>
            {slide.media_url &&
              (slide.media_kind === "video" ? (
                <video className="pa-media-preview" src={slide.media_url} controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="pa-media-preview" src={slide.media_url} alt="" />
              ))}
            <div>
              <input
                className="pa-file-input"
                type="file"
                accept="image/*,video/*"
                onChange={handleUpload}
              />
            </div>
          </div>

          <div className="pa-field">
            <label>Regenerate brief (optional)</label>
            <textarea
              className="pa-textarea"
              placeholder="Steer the next generation call…"
              value={form.brief}
              onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
            />
          </div>

          <div className="pa-btn-row">
            <button className="pa-btn" onClick={save} disabled={busy !== "idle"}>
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
            <button className="pa-btn ghost" onClick={regenerate} disabled={busy !== "idle"}>
              {busy === "regenerating" ? "Regenerating…" : "Regenerate"}
            </button>
            {busy === "uploading" && <span className="pa-save-status">Uploading…</span>}
            {message && (
              <span className={`pa-save-status ${message.ok ? "ok" : "err"}`}>{message.text}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
