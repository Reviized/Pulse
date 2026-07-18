"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "@/app/styles/front-door.css";
import type { Experience, ExperienceMode } from "@/types/database";
import { buildSlidePlan } from "@/lib/slide-plan";

type Stage = "intro" | "mode" | "url" | "gate";

function ModeIcon({ mode }: { mode: ExperienceMode }) {
  const paths: Record<ExperienceMode, JSX.Element> = {
    inform: (
      <>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="11" x2="12" y2="16.2" />
        <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
    train: (
      <>
        <path d="M2.5 9L12 4.3 21.5 9 12 13.7 2.5 9z" />
        <path d="M6.3 11v4.3c0 1.3 2.5 2.4 5.7 2.4s5.7-1.1 5.7-2.4V11" />
        <path d="M20 9.6v5.1" />
      </>
    ),
    sell: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.2" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {paths[mode]}
    </svg>
  );
}

const MODE_COPY: Record<
  ExperienceMode,
  { h: string; d: string; s: string }
> = {
  inform: {
    h: "Who are we introducing?",
    d: "Walk them through who you are and what you do.",
    s: "Drop in the company's website. Pulse scrapes it live and builds the introduction in their brand and tone, grounded in what the site actually says.",
  },
  train: {
    h: "Whose training is this?",
    d: "Teach them a process and verify they got it.",
    s: "Drop in the company's website. Pulse scrapes it live, builds the training deck in their brand and tone, and the narrator opens with a short one on one built from what the site actually says.",
  },
  sell: {
    h: "Who are we selling for?",
    d: "Move them toward a decision.",
    s: "Drop in the company's website. Pulse scrapes it live and builds the pitch in their brand and tone, grounded in what the site actually says.",
  },
};

const loadedGoogleFonts = new Set<string>();
function loadGoogleFont(family: string) {
  if (typeof document === "undefined") return;
  if (loadedGoogleFonts.has(family)) return;
  loadedGoogleFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

type PipelineStepState = "pending" | "live" | "done";
type PipelineStep = { id: string; label: string; state: PipelineStepState };

function stepsForMode(mode: ExperienceMode, host: string): PipelineStep[] {
  const base: PipelineStep[] = [
    { id: "verify", label: `Reading ${host} · brand and identity`, state: "pending" },
    { id: "team", label: "Detecting the team", state: "pending" },
  ];
  if (mode === "train") {
    base.push({ id: "curr", label: "Designing the curriculum", state: "pending" });
  } else if (mode === "sell") {
    base.push({ id: "content", label: "Writing the pitch", state: "pending" });
  } else {
    base.push({ id: "content", label: "Writing the introduction", state: "pending" });
  }
  base.push({ id: "cohesion", label: "The Intelligence Loop · cohesion check", state: "pending" });
  return base;
}

export function FrontDoor() {
  const [stage, setStage] = useState<Stage>("intro");
  const [introGone, setIntroGone] = useState(false);
  const [mode, setMode] = useState<ExperienceMode | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [gravel, setGravel] = useState(false);
  const [brandAccent, setBrandAccent] = useState<string | null>(null);
  const [brandFont, setBrandFont] = useState<string | null>(null);
  const [brandMatched, setBrandMatched] = useState<boolean | null>(null); // null = not checked yet
  const [contentReady, setContentReady] = useState<boolean | null>(null); // null = not checked yet
  const [contentReason, setContentReason] = useState("");
  const [gateName, setGateName] = useState("");
  const [gateEmail, setGateEmail] = useState("");
  const [gateCode, setGateCode] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const introDone = useRef(false);

  useEffect(() => {
    const t = setTimeout(endIntro, 3300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function endIntro() {
    if (introDone.current) return;
    introDone.current = true;
    setIntroGone(true);
    setTimeout(() => setStage("mode"), 700);
  }

  function chooseMode(m: ExperienceMode) {
    setMode(m);
    setStage("url");
  }

  async function markStep(id: string, state: PipelineStepState) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, state } : s)));
  }

  async function postJson(url: string, body: unknown) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
  }

  async function runSetup() {
    const raw = urlValue.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!raw || !mode) return;
    const fullUrl = "https://" + raw;
    setRunning(true);
    const pipelineSteps = stepsForMode(mode, raw);
    setSteps(pipelineSteps);

    // Real call: create the experience row (or a labeled gravel fallback —
    // see app/api/experiences/route.ts). Everything downstream needs a real
    // persisted experience id, so this gates whether the rest of the
    // pipeline can be real too.
    markStep("verify", "live");
    const [result, design] = await Promise.all([
      postJson("/api/experiences", { url: fullUrl, mode }),
      postJson("/api/design-dna", { url: fullUrl }),
    ]);
    markStep("verify", "done");

    if (result?.success) {
      setExperience(result.experience);
      setGravel(Boolean(result.gravel));
    }
    if (design?.success && !design.gravel) {
      const accent = design.designSpec?.palette?.accent as string | undefined;
      const font = design.designSpec?.type?.font_family as string | undefined;
      if (accent) setBrandAccent(accent);
      if (font) {
        setBrandFont(font);
        if (design.googleFont) loadGoogleFont(font);
      }
      setBrandMatched(true);
    } else {
      setBrandMatched(false);
    }

    const experienceId = result?.experience?.id as string | undefined;
    const isReal = Boolean(result?.success && !result?.gravel && experienceId);

    if (!isReal) {
      // No persisted experience id (no SUPABASE_SERVICE_ROLE_KEY, or the
      // write failed) — nothing downstream can be real either. Walk the
      // rest of the checklist as an honest timed placeholder rather than
      // calling routes that would just 404 against a fake id.
      for (const s of pipelineSteps.slice(1)) {
        markStep(s.id, "live");
        await new Promise((res) => setTimeout(res, 500 + Math.random() * 400));
        markStep(s.id, "done");
      }
      setContentReady(false);
      setContentReason("experience was not saved, see the gravel road label above");
      setRunning(false);
      setTimeout(() => setStage("gate"), 500);
      return;
    }

    markStep("team", "live");
    const team = await postJson("/api/detect-team", { experienceId, url: fullUrl });
    markStep("team", "done");
    const profiles = team?.success && !team?.gravel ? team.profiles ?? [] : [];
    const narrator = team?.success && !team?.gravel ? team.narrator ?? null : null;

    const contentStepId = mode === "train" ? "curr" : "content";
    markStep(contentStepId, "live");
    let contentOk = false;
    let reason = "";
    if (mode === "train") {
      const curr = await postJson("/api/generate-curriculum", { experienceId });
      contentOk = Boolean(curr?.success && !curr?.gravel && (curr?.modules?.length ?? 0) > 0);
      reason = curr?.reason ?? "";
    } else {
      const plan = buildSlidePlan(mode, profiles, narrator);
      let wrote = 0;
      for (const slot of plan) {
        const slideResult = await postJson("/api/generate-slide", {
          experienceId,
          position: slot.position,
          layout: slot.layout,
          special: slot.special,
          textPos: slot.textPos,
          speakerProfileId: slot.speakerProfileId,
          brief: slot.brief,
          label: slot.label,
        });
        if (slideResult?.success) wrote++;
        if (slideResult?.reason) reason = slideResult.reason;
      }
      contentOk = wrote > 0;
    }
    markStep(contentStepId, "done");

    markStep("cohesion", "live");
    await postJson("/api/cohesion", { experienceId });
    markStep("cohesion", "done");

    setContentReady(contentOk);
    setContentReason(contentOk ? "" : reason || "content generation did not complete");

    setRunning(false);
    setTimeout(() => setStage("gate"), 500);
  }

  async function tryGate() {
    if (!gateEmail.trim() || !gateCode.trim()) {
      setGateError("Enter your email and the access code.");
      return;
    }
    if (!experience) {
      setGateError("No experience to unlock.");
      return;
    }

    // A gravel experience never made it into the database (no service role
    // key, or the write failed) — there's nothing real for /api/gate to
    // validate or write a lead against, so fall back to the same local
    // check the pre-/api/gate version of this screen used.
    if (gravel) {
      if (gateCode.trim().toUpperCase() !== experience.access_code.toUpperCase()) {
        setGateError("That access code doesn't match. Try again.");
        return;
      }
      setGateError("");
      // A hard navigation, not router.push: verified directly (console
      // logging around the call) that Next's client-side transition can
      // silently no-op here even though push() itself is reached with the
      // right URL — window.location guarantees the browser actually moves,
      // at the cost of a full reload, which is a fine tradeoff for a
      // once-per-session "enter the experience" moment.
      window.location.href = `/frontdoor/${experience.id}`;
      return;
    }

    setGateBusy(true);
    setGateError("");
    const result = await postJson("/api/gate", {
      experienceId: experience.id,
      email: gateEmail.trim(),
      code: gateCode.trim(),
    });
    setGateBusy(false);

    if (result?.error) {
      setGateError(result.error);
      return;
    }
    if (result?.success && result.unlocked === false) {
      setGateError("That access code doesn't match. Try again.");
      return;
    }
    if (!result?.success) {
      setGateError("Something went wrong unlocking this experience. Try again.");
      return;
    }
    window.location.href = `/frontdoor/${experience.id}`;
  }

  const companyWords = (experience?.company_name ?? "Your Company").toUpperCase().split(" ");
  const goldWordIdx = companyWords.length >= 3 ? 1 : 0;

  return (
    <div className="pulse-fd" data-mode={mode ?? "inform"}>
      {/* ═══ INTRO ═══ */}
      {stage === "intro" && (
        <div className={`pi-root${introGone ? " gone" : ""}`} onClick={endIntro}>
          <div className="pi-stage">
            <div style={{ position: "relative" }}>
              <svg className="pi-ekg" viewBox="0 0 760 140" preserveAspectRatio="xMidYMid meet">
                <path d="M0,70 L210,70 L245,70 L262,40 L280,104 L298,14 L318,122 L338,52 L354,70 L400,70 L418,58 L436,82 L452,70 L560,70 L760,70" />
              </svg>
              <span className="pi-ring r1" />
              <span className="pi-ring r2" />
              <span className="pi-ring r3" />
            </div>
            <div className="pi-word">
              {"PULSE".split("").map((c, i) => (
                <span key={i} style={{ animationDelay: `${1.05 + i * 0.09}s` }}>
                  {c}
                </span>
              ))}
            </div>
            <div className="pi-sub">
              Inform · Train · Sell · powered by <b>Pulse 3.0</b>
            </div>
            <div className="pi-tag">One URL becomes an experience. Watch.</div>
            <div className="pi-skip">Click to skip</div>
          </div>
        </div>
      )}

      {/* ═══ MODE PICK ═══ */}
      {stage === "mode" && (
        <div className="fd-setup">
          <div className="fd-card modepick">
            <div className="fd-mark" style={{ textAlign: "center" }}>
              PULSE <b>3.0</b>
            </div>
            <div className="fd-sub">A REViiZED Product</div>
            <h1 className="sp-h1">What are you here to do?</h1>
            <p className="lede">Choose a mode. We will tailor the whole experience to it.</p>
            <div className="mode-cards">
              {(["inform", "train", "sell"] as ExperienceMode[]).map((m) => (
                <button key={m} className="mcard" data-m={m} onClick={() => chooseMode(m)}>
                  <span className="micon">
                    <ModeIcon mode={m} />
                  </span>
                  <b>{m[0].toUpperCase() + m.slice(1)}</b>
                  <span className="mdesc">{MODE_COPY[m].d}</span>
                  <span className="menter">Enter →</span>
                </button>
              ))}
            </div>
            <button className="fd-admin-pill" disabled title="Admin panel — later phase">
              ⚙ Admin · team only
            </button>
          </div>
        </div>
      )}

      {/* ═══ URL ENTRY + PIPELINE ═══ */}
      {stage === "url" && mode && (
        <div className="fd-setup">
          <div className="fd-card">
            <div className="fd-mark">
              PULSE <b>3.0</b>
            </div>
            <div className="fd-sub">
              A REViiZED Product · {mode[0].toUpperCase() + mode.slice(1)} Mode
            </div>
            <h1>{MODE_COPY[mode].h}</h1>
            <p className="lede">{MODE_COPY[mode].s}</p>
            <div className="fd-row">
              <span className="proto">https://</span>
              <input
                className="fd-url"
                type="text"
                placeholder="anycompany.com"
                spellCheck={false}
                value={urlValue}
                disabled={running}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSetup();
                }}
              />
              <button className="fd-go" onClick={runSetup} disabled={running || !urlValue.trim()}>
                {running ? "…" : "Create Pulse"}
              </button>
            </div>
            {steps.length > 0 && (
              <div className="fd-prog">
                {steps.map((s) => (
                  <div key={s.id} className={`fd-prog-item ${s.state}`}>
                    <span className="ic">{s.state === "done" ? "✓" : s.state === "live" ? "◉" : "○"}</span>
                    {s.label}
                  </div>
                ))}
              </div>
            )}
            {!running && (
              <button className="fd-skip" onClick={() => setStage("mode")}>
                ← Change mode
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ GATE ═══ */}
      {stage === "gate" && (
        <div
          className="gate-root show"
          style={
            brandAccent
              ? ({ "--mode": brandAccent } as CSSProperties)
              : undefined
          }
        >
          <div
            className="gate-card"
            style={brandFont ? { fontFamily: `${brandFont}, var(--display)` } : undefined}
          >
            <div className="gate-mark">
              {companyWords.map((w, i) => (
                <span key={i}>
                  {i === goldWordIdx ? (
                    <span style={{ color: brandAccent ?? "var(--gold)" }}>{w}</span>
                  ) : (
                    w
                  )}
                  {i < companyWords.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
            <div className="gate-sub">
              A Pulse Experience
              {gravel ? " · gravel road (unsaved demo)" : ""}
              {brandMatched === true ? " · brand matched from live site" : ""}
              {brandMatched === false ? " · default Pulse branding (no signal found)" : ""}
            </div>
            <h1 style={brandFont ? { fontFamily: `${brandFont}, var(--display)` } : undefined}>
              Before we begin, let&apos;s get introduced.
            </h1>
            <p>Enter your email and access code to unlock this experience.</p>
            <input
              className="gate-field"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              value={gateName}
              onChange={(e) => setGateName(e.target.value)}
            />
            <input
              className="gate-field"
              type="email"
              placeholder="Work email"
              autoComplete="email"
              value={gateEmail}
              onChange={(e) => setGateEmail(e.target.value)}
            />
            <input
              className="gate-field gate-code"
              type="text"
              maxLength={6}
              placeholder="ACCESS CODE"
              autoComplete="off"
              value={gateCode}
              onChange={(e) => setGateCode(e.target.value)}
            />
            <button className="fd-go fd-go-block" onClick={tryGate} disabled={gateBusy}>
              {gateBusy ? "Unlocking…" : "Unlock Experience"}
            </button>
            <div className="gate-error">{gateError}</div>
            <div className="gate-hint">
              Pilot access code: <code>{experience?.access_code ?? "REV123"}</code>
            </div>
            {contentReady === false && (
              <div className="gate-hint" style={{ color: "#d97a7a" }}>
                {mode === "train" ? "Curriculum" : "Deck"} not generated yet
                {contentReason ? `: ${contentReason}` : ""}
              </div>
            )}
            <button className="fd-skip" style={{ marginTop: 18 }} onClick={() => setStage("mode")}>
              ← Back to the front door
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
