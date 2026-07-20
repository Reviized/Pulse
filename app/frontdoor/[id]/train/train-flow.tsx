"use client";

import { useEffect, useRef, useState } from "react";
import "@/app/styles/train.css";
// .pd-dock and .pd-gate-overlay (the presenter navigation dock and its Gate
// reentry card) live in deck.css, styled for components/slide-viewer.tsx.
// Pulled in here too rather than duplicated, so both routes share one
// source of truth for that nav chrome.
import "@/app/styles/deck.css";
import { PresenterDock } from "@/components/presenter-dock";
import type { Narrator } from "@/types/database";
import type { RatingModule, PlayerModule } from "./actions";
import {
  getModulesForPlayer,
  fetchTraineeSession,
  submitCheckpointAnswer,
  completeTrainSession,
} from "./actions";

type Stage = "intro" | "self-ratings" | "insights" | "interview" | "inferring" | "player" | "results";

type TrainFlowProps = {
  experienceId: string;
  companyName: string;
  accessCode: string;
  narrator: Narrator | null;
  modules: RatingModule[];
};

// Ambient shape for the (non-standard, Chrome/Safari-only) Web Speech API —
// no @types package is installed, and editing package.json is out of scope,
// so this is typed loosely on purpose rather than declared globally.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TrainFlow({ experienceId, companyName, accessCode, narrator, modules }: TrainFlowProps) {
  const [stage, setStage] = useState<Stage>("intro");
  // Section 9's presenter dock: same "Gate reentry" pattern as
  // slide-viewer.tsx's GateOverlay. Train mode has no in-page Gate stage to
  // reopen (the Gate lives entirely in front-door.tsx, before this route
  // ever mounts), so this renders the same self-contained presenter view.
  const [gateOpen, setGateOpen] = useState(false);
  // Gravel-road default: the Gate → /frontdoor/[id]/train handoff (owned by
  // front-door.tsx, out of this build's scope) doesn't currently forward the
  // trainee's email or a session key into this route, so the Train flow
  // collects the trainee's email itself on the intro screen — it's a
  // required column on train_sessions and there's no other source for it
  // here. sessionKey is minted client-side purely for /api/track analytics.
  const [traineeEmail, setTraineeEmail] = useState("");
  const [sessionKey] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : `loc-${Date.now()}`));

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [trainSessionId, setTrainSessionId] = useState<string | null>(null);
  const [insight, setInsight] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [insightsGravel, setInsightsGravel] = useState(false);

  // interview state
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tavusGravel, setTavusGravel] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  // Not rendered — each answer is persisted to train_sessions immediately via
  // the tavus route's "transcript" action, so this is just a local mirror in
  // case a later screen wants to show a review; a ref avoids a pointless
  // re-render on every keystroke-adjacent update.
  const transcriptRef = useRef<{ q: string; a: string }[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [listening, setListening] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  const [playerModules, setPlayerModules] = useState<PlayerModule[]>([]);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [substage, setSubstage] = useState<"lesson" | "checkpoint">("lesson");
  const [picked, setPicked] = useState<number | null>(null);
  const [pickedCorrect, setPickedCorrect] = useState<boolean | null>(null);

  const [results, setResults] = useState<{
    ratings: Record<string, { self: number; checkpoint: boolean | null }>;
    routeOrder: string[];
  } | null>(null);

  const allRated = modules.length > 0 && modules.every((m) => ratings[m.id] != null);

  // Tear down camera/mic/timer cleanly on unmount or whenever we leave the
  // interview stage (Section 9: "never leave a hot mic or camera running in
  // the background").
  function teardownInterview() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recogRef.current) {
      try {
        recogRef.current.stop();
      } catch {
        // already stopped
      }
      recogRef.current = null;
      setListening(false);
    }
  }
  useEffect(() => () => teardownInterview(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && gateOpen) setGateOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gateOpen]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // camera/mic permission denied or unavailable — the trainee pane just
      // shows the "camera unavailable" placeholder, never a broken <video>
      setCamOn(false);
    }
  }

  function toggleMic() {
    if (!streamRef.current) return;
    const next = !micOn;
    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }
  function toggleCam() {
    if (!streamRef.current) return;
    const next = !camOn;
    streamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  function startMicToText() {
    const SR =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
        : undefined;
    if (!SR) return;
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
      setListening(false);
      return;
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.onresult = (ev) => {
      const results = (ev as { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }).results;
      let t = "";
      for (let i = 0; i < results.length; i++) t += results[i][0].transcript;
      setAnswerDraft(t);
    };
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
    };
    recog.onerror = () => {
      setListening(false);
      recogRef.current = null;
    };
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }

  async function beginTraining() {
    if (!traineeEmail.trim()) return;
    setStage("self-ratings");
  }

  function rate(moduleId: string, value: number) {
    setRatings((prev) => ({ ...prev, [moduleId]: value }));
  }

  async function submitRatings() {
    setInsightsBusy(true);
    const res = await postJson("/api/preinterview/insights", { experienceId, ratings, traineeEmail: traineeEmail.trim() });
    setInsightsBusy(false);
    if (res?.success) {
      setTrainSessionId(res.trainSessionId ?? null);
      setInsight(res.insight ?? "");
      setQuestions(Array.isArray(res.questions) ? res.questions : []);
      setInsightsGravel(Boolean(res.gravel));
      setStage("insights");
    }
  }

  async function beginInterview() {
    setStage("interview");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    startCamera();

    if (trainSessionId) {
      const res = await postJson("/api/preinterview/tavus", { action: "create", trainSessionId });
      if (res?.success && !res?.gravel) {
        setConversationUrl(res.conversationUrl);
        setConversationId(res.conversationId);
        setTavusGravel(false);
      } else {
        setTavusGravel(true);
      }
    } else {
      setTavusGravel(true);
    }
  }

  async function submitAnswer() {
    const q = questions[qIdx];
    const a = answerDraft.trim();
    if (!q) return;
    const entry = { q, a };
    transcriptRef.current.push(entry);
    setAnswerDraft("");
    if (recogRef.current) {
      recogRef.current.stop();
    }
    if (trainSessionId) {
      postJson("/api/preinterview/tavus", { action: "transcript", trainSessionId, entry });
    }
    if (qIdx + 1 >= questions.length) {
      await finishInterview();
    } else {
      setQIdx((i) => i + 1);
    }
  }

  async function finishInterview() {
    teardownInterview();
    if (conversationId) {
      await postJson("/api/preinterview/tavus", { action: "end", trainSessionId, conversationId });
      postJson("/api/preinterview/tavus", { action: "get", trainSessionId, conversationId });
    }
    setStage("inferring");
    if (!trainSessionId) {
      setStage("results");
      return;
    }
    const infer = await postJson("/api/preinterview/infer", { trainSessionId });
    void infer; // response intentionally carries nothing but {success, gravel, routeReady} — never inferred/signal

    const safe = await fetchTraineeSession(trainSessionId);
    if (!safe) {
      setStage("results");
      return;
    }
    const players = await getModulesForPlayer(experienceId, safe.routeOrder);
    setPlayerModules(players);
    setModuleIdx(0);
    setSubstage("lesson");
    setStage("player");
  }

  function leaveInterviewEarly() {
    teardownInterview();
    finishInterview();
  }

  async function answerCheckpoint(idx: number) {
    if (picked != null) return;
    const mod = playerModules[moduleIdx];
    if (!mod || !trainSessionId) return;
    setPicked(idx);
    const res = await submitCheckpointAnswer(trainSessionId, mod.id, idx);
    setPickedCorrect(res.correct);
  }

  function nextModule() {
    setPicked(null);
    setPickedCorrect(null);
    if (moduleIdx + 1 >= playerModules.length) {
      finishTraining();
    } else {
      setModuleIdx((i) => i + 1);
      setSubstage("lesson");
    }
  }

  async function finishTraining() {
    if (trainSessionId) {
      const safe = await completeTrainSession(trainSessionId);
      if (safe) setResults({ ratings: safe.ratings, routeOrder: safe.routeOrder });
      postJson("/api/track", {
        experienceId,
        sessionKey,
        events: [{ event: "complete", slideRef: "tres" }],
      });
    }
    setStage("results");
  }

  const narratorInitial = (narrator?.preferredName ?? narrator?.name ?? "Pulse Narrator").charAt(0).toUpperCase();

  return (
    <div className="pulse-tr">
      <div className="tr-shell">
        {stage === "intro" && (
          <div className="tr-card">
            <div className="tr-mark">
              PULSE <b>3.0</b>
            </div>
            <div className="tr-eyebrow">Train Mode · {companyName}</div>
            <h1>Before we train, let&apos;s talk.</h1>
            <div className="tr-narrator">
              {narrator?.videoUrl ? (
                <video src={narrator.videoUrl} controls playsInline />
              ) : (
                <div className="tr-narrator-poster">
                  <div className="tr-narrator-avatar">{narratorInitial}</div>
                  <div className="tr-narrator-name">{narrator?.preferredName ?? narrator?.name ?? "Pulse Narrator"}</div>
                  <div className="tr-narrator-title">{narrator?.title || "Your Training Guide"}</div>
                  <div className="tr-narrator-gravel">Gravel · replica video not rendered yet</div>
                </div>
              )}
            </div>
            <p className="lede">
              We will start with a few quick self-ratings, talk face to face for a couple of minutes, and then walk
              through your training path together.
            </p>
            <input
              className="tr-field"
              type="email"
              placeholder="Your work email"
              autoComplete="email"
              value={traineeEmail}
              onChange={(e) => setTraineeEmail(e.target.value)}
            />
            <button className="tr-cta tr-cta-block" onClick={beginTraining} disabled={!traineeEmail.trim()}>
              Continue
            </button>
          </div>
        )}

        {stage === "self-ratings" && (
          <div className="tr-card">
            <div className="tr-eyebrow">Step 1 of 3 · Self-Ratings</div>
            <h1>Rate yourself, honestly.</h1>
            <p className="lede">1 is brand new to this, 5 is you could teach it. There are no wrong answers here.</p>
            {modules.length === 0 ? (
              <p className="lede">No training curriculum has been generated for this experience yet.</p>
            ) : (
              <div className="tr-rating-list">
                {modules.map((m) => (
                  <div className="tr-rating-item" key={m.id}>
                    <div className="tri-title">{m.title}</div>
                    <div className="tri-obj">{m.objective}</div>
                    <div className="tr-scale">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          className={ratings[m.id] === v ? "active" : ""}
                          onClick={() => rate(m.id, v)}
                          type="button"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="tr-scale-labels">
                      <span>New to this</span>
                      <span>Could teach it</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="tr-cta tr-cta-block" onClick={submitRatings} disabled={!allRated || insightsBusy}>
              {insightsBusy ? "Thinking…" : "Continue"}
            </button>
          </div>
        )}

        {stage === "insights" && (
          <div className="tr-card">
            <div className="tr-eyebrow">Step 2 of 3 · Preliminary Read</div>
            <h1>Here is what I am hearing.</h1>
            <div className="tr-insight-box">
              &ldquo;{insight}&rdquo;
              {insightsGravel && <div style={{ marginTop: 10, fontFamily: "var(--body)", fontStyle: "normal", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)" }}>Gravel · generated read unavailable, using a placeholder</div>}
            </div>
            <p className="lede">I have four questions for you. We will go through them together, face to face.</p>
            <div className="tr-qpreview">
              {questions.map((q, i) => (
                <div className="tr-qpreview-item" key={i}>
                  <b>Q{i + 1}</b>
                  <span>{q}</span>
                </div>
              ))}
            </div>
            <button className="tr-cta tr-cta-block" onClick={beginInterview}>
              Begin the Interview
            </button>
          </div>
        )}

        {stage === "interview" && (
          <div className="tr-room-wrap">
            <div className="tr-room-head">
              <div className="tr-room-pill">
                Video interview <b>{companyName}</b>
                {tavusGravel && " · text mode (video unavailable)"}
              </div>
              <div className="tr-timer">{formatTimer(seconds)}</div>
            </div>
            <div className="tr-panes">
              <div className="tr-pane">
                {conversationUrl ? (
                  <iframe src={conversationUrl} allow="camera; microphone; autoplay" />
                ) : (
                  <div className="tr-pane-placeholder">
                    <div className="tr-narrator-avatar">{narratorInitial}</div>
                    <div className="tr-narrator-name" style={{ fontSize: 16 }}>
                      {narrator?.preferredName ?? narrator?.name ?? "Pulse Narrator"}
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase" }}>
                      {tavusGravel ? "Gravel · continuing as a text interview" : "Connecting…"}
                    </span>
                  </div>
                )}
                <span className="tr-pane-label">Interviewer</span>
              </div>
              <div className="tr-pane">
                {camOn ? (
                  <video ref={videoRef} autoPlay muted playsInline />
                ) : (
                  <div className="tr-camoff">Camera off</div>
                )}
                <span className="tr-pane-label">You</span>
              </div>
            </div>
            <div className="tr-qa-strip">
              <div className="tr-qa-progress">
                Question {Math.min(qIdx + 1, questions.length)} of {questions.length}
              </div>
              <div className="tr-qa-question">{questions[qIdx]}</div>
              <div className="tr-qa-form">
                <textarea
                  className="tr-qa-textarea"
                  placeholder="Type or speak your answer…"
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                />
                <button
                  type="button"
                  className={`tr-mic-btn${listening ? " live" : ""}`}
                  onClick={startMicToText}
                  title="Speak your answer"
                >
                  ●
                </button>
                <button className="tr-cta" onClick={submitAnswer} disabled={!answerDraft.trim()}>
                  Next
                </button>
              </div>
            </div>
            <div className="tr-controls">
              <button className={`tr-ctrl-btn${micOn ? "" : " off"}`} onClick={toggleMic} title="Toggle mic">
                {micOn ? "🎙" : "🔇"}
              </button>
              <button className={`tr-ctrl-btn${camOn ? "" : " off"}`} onClick={toggleCam} title="Toggle camera">
                {camOn ? "🎥" : "📷"}
              </button>
              <button className="tr-end-btn" onClick={leaveInterviewEarly}>
                End Interview
              </button>
            </div>
          </div>
        )}

        {stage === "inferring" && (
          <div className="tr-card">
            <div className="tr-building">
              <div className="tr-spinner" />
              <div className="tr-building-label">Building your path…</div>
            </div>
          </div>
        )}

        {stage === "player" && playerModules[moduleIdx] && (
          <div className="tr-player-wrap">
            <div className="tr-chapter-nav">
              <div className="tr-chapter-dots">
                {playerModules.map((_, i) => (
                  <span key={i} className={`tr-chapter-dot${i < moduleIdx ? " done" : i === moduleIdx ? " active" : ""}`} />
                ))}
              </div>
              <div className="tr-chapter-count">
                Module {moduleIdx + 1} of {playerModules.length}
              </div>
            </div>

            {substage === "lesson" && (
              <>
                <div className="tr-lesson-card">
                  <div className="tr-eyebrow">{playerModules[moduleIdx].objective}</div>
                  <h2>{playerModules[moduleIdx].title}</h2>
                  {playerModules[moduleIdx].lesson.map((p, i) => (
                    <p className="tr-lesson-p" key={i}>
                      {p}
                    </p>
                  ))}
                  {playerModules[moduleIdx].keyPoints.length > 0 && (
                    <ul className="tr-key-points">
                      {playerModules[moduleIdx].keyPoints.map((k, i) => (
                        <li key={i}>{k}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  className="tr-cta tr-cta-block"
                  onClick={() => (playerModules[moduleIdx].checkpoint ? setSubstage("checkpoint") : nextModule())}
                >
                  {playerModules[moduleIdx].checkpoint ? "Continue to Checkpoint" : "Continue"}
                </button>
              </>
            )}

            {substage === "checkpoint" && playerModules[moduleIdx].checkpoint && (
              <>
                <div className="tr-checkpoint-card">
                  <div className="tr-eyebrow">Checkpoint</div>
                  <div className="tr-checkpoint-q">{playerModules[moduleIdx].checkpoint!.q}</div>
                  <div className="tr-options">
                    {playerModules[moduleIdx].checkpoint!.options.map((opt, i) => {
                      let cls = "tr-option";
                      if (picked === i) cls += pickedCorrect ? " picked-correct" : " picked-wrong";
                      return (
                        <button key={i} className={cls} disabled={picked != null} onClick={() => answerCheckpoint(i)}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {picked != null && (
                    <div className={`tr-checkpoint-result ${pickedCorrect ? "correct" : "wrong"}`}>
                      {pickedCorrect ? "Correct." : "Not quite, but that's what training is for."}
                    </div>
                  )}
                </div>
                <button className="tr-cta tr-cta-block" onClick={nextModule} disabled={picked == null}>
                  {moduleIdx + 1 >= playerModules.length ? "Finish Training" : "Next Module"}
                </button>
              </>
            )}
          </div>
        )}

        {stage === "results" && (
          <div className="tr-card">
            <div className="tr-eyebrow">Training Complete</div>
            <h1>Nice work.</h1>
            {results && (
              <>
                <div className="tr-results-summary">
                  You completed {Object.values(results.ratings).filter((r) => r.checkpoint === true).length} of{" "}
                  {Object.values(results.ratings).filter((r) => r.checkpoint !== null).length} checkpoints
                </div>
                <p className="lede">Here is a look at how you rated yourself across each module.</p>
                <div className="tr-results-bars">
                  {results.routeOrder.map((moduleId) => {
                    const r = results.ratings[moduleId];
                    const mod = playerModules.find((m) => m.id === moduleId);
                    if (!r || !mod) return null;
                    return (
                      <div className="tr-bar-row" key={moduleId}>
                        <div className="tr-bar-label">{mod.title}</div>
                        <div className="tr-bar-track">
                          <div className="tr-bar-fill" style={{ width: `${(r.self / 5) * 100}%` }} />
                        </div>
                        <div className={`tr-bar-check ${r.checkpoint === true ? "pass" : r.checkpoint === false ? "fail" : "pending"}`}>
                          {r.checkpoint === true ? "✓" : r.checkpoint === false ? "✗" : "–"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <p className="lede">Thanks for training with {companyName}. Your responses have been recorded.</p>
          </div>
        )}
      </div>

      <PresenterDock
        onShowGate={() => setGateOpen(true)}
        onJumpExperience={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
      {gateOpen && (
        <TrainGateOverlay companyName={companyName} accessCode={accessCode} onClose={() => setGateOpen(false)} />
      )}
    </div>
  );
}

/**
 * Train mode's version of slide-viewer.tsx's GateOverlay — same idea (a
 * self-contained presenter view of the access screen a visitor saw, built
 * from data already loaded server-side), reusing the .pd-gate-overlay /
 * .pd-gate-card classes from deck.css so both flows look identical.
 */
function TrainGateOverlay({
  companyName,
  accessCode,
  onClose,
}: {
  companyName: string;
  accessCode: string;
  onClose: () => void;
}) {
  return (
    <div className="pd-gate-overlay" onClick={onClose}>
      <div className="pd-gate-card" onClick={(e) => e.stopPropagation()}>
        <div className="pd-gate-mark">{companyName}</div>
        <div className="pd-gate-sub">The Gate, presenter view</div>
        <h2>This is the screen visitors saw to unlock this experience</h2>
        <p>
          Email plus access code. The pilot access code for this experience is <code>{accessCode}</code>.
        </p>
        <button type="button" className="pd-gate-close" onClick={onClose}>
          Back to the Experience
        </button>
      </div>
    </div>
  );
}
