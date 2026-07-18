"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "@/app/styles/deck.css";
import type { Experience, ExperienceMode, Profile, Slide } from "@/types/database";
import { useAnalyticsQueue } from "@/lib/data/analytics";
import { PulsePoint } from "@/components/pulse-point";
import { PresenterDock } from "@/components/presenter-dock";

/**
 * Full-bleed scroll-snap deck (Section 9: "Scroll-snap deck: opening video
 * ... generated content slides in the six locked layouts ... Team ...
 * Leader Spotlight ... Ask slide where the Pulse Point centers and Q&A
 * opens"). Visual language matches app/styles/front-door.css exactly (same
 * tokens, re-declared in app/styles/deck.css per the task's instruction not
 * to edit front-door.css directly) rather than the generic Tailwind
 * placeholder this file used to be.
 */

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

export function SlideViewer({
  experience,
  slides,
  profiles,
}: {
  experience: Experience;
  slides: Slide[];
  profiles: Profile[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const dwellStartRef = useRef(0);
  const completeTrackedRef = useRef(false);
  const [ppOpen, setPpOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Per-visit session key, kept in a ref (never persisted) so a full page
  // reload starts a fresh session, matching the pattern in app/api/gate.
  const sessionKeyRef = useRef("");
  if (!sessionKeyRef.current) sessionKeyRef.current = crypto.randomUUID();
  const sessionKey = sessionKeyRef.current;

  const { track } = useAnalyticsQueue(experience.id, sessionKey);

  const accent = experience.design_spec?.palette?.accent;
  const fontFamily = experience.design_spec?.type?.font_family;

  useEffect(() => {
    if (fontFamily) loadGoogleFont(fontFamily);
  }, [fontFamily]);

  // Fire the very first "view" once on mount, before any scroll happens.
  useEffect(() => {
    dwellStartRef.current = Date.now();
    const first = slides[0];
    if (first) track("view", first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the active slide via IntersectionObserver against the scroll-snap
  // container, batching view/dwell/complete events into the analytics
  // queue rather than writing per-scroll (CLAUDE.md: "batch analytics
  // writes, per-scroll writes melted storage").
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const idxAttr = (entry.target as HTMLElement).dataset.slideIndex;
          if (idxAttr === undefined) continue;
          const idx = Number(idxAttr);
          if (idx === activeIndexRef.current) continue;

          const prevSlide = slides[activeIndexRef.current];
          if (prevSlide) track("dwell", prevSlide.id, Date.now() - dwellStartRef.current);

          activeIndexRef.current = idx;
          dwellStartRef.current = Date.now();
          setActiveIndex(idx);

          const slide = slides[idx];
          if (slide) {
            track("view", slide.id);
            if (idx === slides.length - 1 && !completeTrackedRef.current) {
              completeTrackedRef.current = true;
              track("complete", slide.id);
            }
          }
        }
      },
      { root, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Section 9: "Escape closes Admin if open, else exits the pre-interview
      // to the Front Door." Neither Admin nor the live interview mount on
      // this route (out of scope here); the one overlay this page owns is
      // the presenter dock's Gate reentry, so Escape closes that.
      if (e.key === "Escape" && gateOpen) setGateOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gateOpen]);

  function scrollToIndex(i: number) {
    slideRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePpOpenChange(next: boolean) {
    if (next && !ppOpen) track("pp_open", slides[activeIndexRef.current]?.id);
    setPpOpen(next);
  }

  const activeSlide = slides[activeIndex];
  const speakerProfile = activeSlide?.speaker_profile_id
    ? profiles.find((p) => p.id === activeSlide.speaker_profile_id) ?? null
    : null;

  const rootStyle = {
    ...(accent ? { "--mode": accent } : {}),
    ...(fontFamily ? { "--display": `'${fontFamily}', Anton, Impact, sans-serif` } : {}),
  } as CSSProperties;

  return (
    <div className="pulse-deck" data-mode={experience.mode} style={rootStyle}>
      <div className="pd-scroll" ref={containerRef}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            data-slide-index={i}
            className="pd-slide"
            data-layout={slide.layout}
            data-special={slide.special ?? undefined}
            data-textpos={slide.text_pos ?? "center"}
          >
            <SlideBody slide={slide} profiles={profiles} onAskOpen={() => handlePpOpenChange(true)} />
          </div>
        ))}
      </div>

      <SlideRail count={slides.length} activeIndex={activeIndex} onJump={scrollToIndex} />

      <PresenterDock onShowGate={() => setGateOpen(true)} onJumpExperience={() => scrollToIndex(0)} />

      {gateOpen && <GateOverlay experience={experience} onClose={() => setGateOpen(false)} />}

      <PulsePoint
        open={ppOpen}
        onOpenChange={handlePpOpenChange}
        experienceId={experience.id}
        sessionKey={sessionKey}
        speakerProfileId={activeSlide?.speaker_profile_id ?? null}
        speakerName={speakerProfile?.name ?? null}
        hideTrigger={activeSlide?.special === "ask"}
      />
    </div>
  );
}

/** Never an empty deck (Section 9): rendered from app/frontdoor/[id]/page.tsx
 *  in place of the scroll-snap deck whenever there's no generated content to
 *  show yet, with a clear message and a way back to the Front Door. */
export function DeckEmptyState({
  mode,
  companyName,
  reason,
}: {
  mode?: ExperienceMode;
  companyName?: string | null;
  reason: string;
}) {
  return (
    <div className="pulse-deck pd-empty" data-mode={mode ?? "inform"}>
      <div className="pd-empty-card">
        <div className="pd-empty-mark">Pulse</div>
        <h1>
          {companyName ? `${companyName}, your experience isn't ready yet` : "This experience isn't ready yet"}
        </h1>
        <p>{reason}</p>
        <a href="/">Return to the Front Door</a>
      </div>
    </div>
  );
}

/* ═══ Slide body dispatch, one function per layout / special ═══ */

function SlideBody({
  slide,
  profiles,
  onAskOpen,
}: {
  slide: Slide;
  profiles: Profile[];
  onAskOpen: () => void;
}) {
  if (slide.special === "ask") return <AskSlideBody slide={slide} onAskOpen={onAskOpen} />;
  if (slide.special === "team") return <TeamSlideBody slide={slide} />;
  if (slide.special === "spotlight") return <SpotlightSlideBody slide={slide} profiles={profiles} />;

  switch (slide.layout) {
    case "media_full":
      return <MediaFullSlideBody slide={slide} />;
    case "split":
      return <SplitSlideBody slide={slide} />;
    case "three_quarter":
      return <ThreeQuarterSlideBody slide={slide} />;
    case "stats":
      return <StatsSlideBody slide={slide} />;
    case "waveform":
      return <WaveformSlideBody slide={slide} />;
    case "text_only":
    default:
      return <TextOnlySlideBody slide={slide} />;
  }
}

function SlideHeader({ slide }: { slide: Slide }) {
  return (
    <>
      {slide.eyebrow && <p className="pd-eyebrow">{slide.eyebrow}</p>}
      {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
      {slide.body && <p className="pd-body">{slide.body}</p>}
      {slide.sig && <p className="pd-sig">{slide.sig}</p>}
      {slide.chips && slide.chips.length > 0 && (
        <div className="pd-chips">
          {slide.chips.map((c, i) => (
            <span key={i} className="pd-chip">
              {c}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function SlideMedia({ slide, className }: { slide: Slide; className?: string }) {
  if (!slide.media_url) {
    return (
      <div className="pd-media-empty">
        <span>Media pending</span>
      </div>
    );
  }
  if (slide.media_kind === "video") {
    return <video src={slide.media_url} className={className} autoPlay muted loop playsInline />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={slide.media_url} alt={slide.headline ?? ""} className={className} />;
}

function TextOnlySlideBody({ slide }: { slide: Slide }) {
  return (
    <div className="pd-textblock">
      <SlideHeader slide={slide} />
    </div>
  );
}

function MediaFullSlideBody({ slide }: { slide: Slide }) {
  const isVideoSpecial = slide.special === "video";
  return (
    <>
      <div className="pd-media">
        {slide.media_url ? (
          <SlideMedia slide={slide} />
        ) : isVideoSpecial ? (
          <div className="pd-media-empty pd-media-poster">
            <div className="pd-waveform" aria-hidden="true">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${(i % 8) * 0.09}s` }} />
              ))}
            </div>
            <span>Digital Replica pending</span>
          </div>
        ) : (
          <div className="pd-media-empty">
            <span>Media pending</span>
          </div>
        )}
      </div>
      <div className="pd-scrim" />
      <div className="pd-textblock">
        <SlideHeader slide={slide} />
      </div>
    </>
  );
}

function SplitSlideBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="pd-textblock">
        <SlideHeader slide={slide} />
      </div>
      <div className="pd-media-col">
        <SlideMedia slide={slide} />
      </div>
    </>
  );
}

function ThreeQuarterSlideBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="pd-textblock">
        <SlideHeader slide={slide} />
      </div>
      <div className="pd-media-col">
        <SlideMedia slide={slide} />
      </div>
    </>
  );
}

type StatItem = { label?: string; value?: string };

function StatsSlideBody({ slide }: { slide: Slide }) {
  const items = (Array.isArray(slide.items) ? slide.items : []) as StatItem[];
  return (
    <div className="pd-textblock">
      {slide.eyebrow && <p className="pd-eyebrow">{slide.eyebrow}</p>}
      {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
      <div className="pd-stat-grid">
        {items.map((item, i) => (
          <div key={i} className="pd-stat-tile">
            <div className="pd-stat-value">{item.value || "N/A"}</div>
            <div className="pd-stat-label">{item.label || ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaveformSlideBody({ slide }: { slide: Slide }) {
  return (
    <div className="pd-textblock">
      {slide.eyebrow && <p className="pd-eyebrow">{slide.eyebrow}</p>}
      {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
      <div className="pd-waveform" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${(i % 8) * 0.09}s` }} />
        ))}
      </div>
      {slide.body && <p className="pd-body">{slide.body}</p>}
      {slide.sig && <p className="pd-sig">{slide.sig}</p>}
      {slide.script && (
        /* narration audio isn't a stored column yet (Section 6, item 9:
           /api/voiceover renders it on demand, cached in Storage) — gravel
           until that route is wired, decorative waveform above stands in */
        <p className="pd-waveform-note">Narration pending, voiceover not yet wired</p>
      )}
    </div>
  );
}

type TeamItem = { name?: string; title?: string; headshot_url?: string | null };

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeamSlideBody({ slide }: { slide: Slide }) {
  const items = (Array.isArray(slide.items) ? slide.items : []) as TeamItem[];
  return (
    <div className="pd-textblock">
      {slide.eyebrow && <p className="pd-eyebrow">{slide.eyebrow}</p>}
      {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
      <div className="pd-team-grid">
        {items.map((m, i) => (
          <div key={i} className="pd-team-card">
            {m.headshot_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.headshot_url} alt={m.name ?? ""} className="pd-team-photo" />
            ) : (
              <div className="pd-team-monogram">{initials(m.name)}</div>
            )}
            <div className="pd-team-name">{m.name}</div>
            {m.title && <div className="pd-team-title">{m.title}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotlightSlideBody({ slide, profiles }: { slide: Slide; profiles: Profile[] }) {
  // The generate-slide route doesn't populate media_url for the spotlight
  // slot yet (Slide Manager's per-item media attach is out of this file's
  // scope), so fall back to the real detected headshot from the matching
  // profile before falling back to a monogram — better than always showing
  // initials when a real photo is already sitting in `profiles`.
  const speaker = slide.speaker_profile_id
    ? profiles.find((p) => p.id === slide.speaker_profile_id) ?? null
    : null;
  const photoUrl = slide.media_url ?? speaker?.headshot_url ?? null;

  return (
    <>
      <div className="pd-textblock">
        <p className="pd-eyebrow">{slide.eyebrow ?? "Leader Spotlight"}</p>
        {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
        {slide.sig && <p className="pd-sig">{slide.sig}</p>}
        {slide.body && <p className="pd-body">{slide.body}</p>}
      </div>
      <div className="pd-media-col">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={slide.headline ?? ""} className="pd-spot-portrait" />
        ) : (
          <div className="pd-spot-monogram">{initials(slide.headline)}</div>
        )}
      </div>
    </>
  );
}

function AskSlideBody({ slide, onAskOpen }: { slide: Slide; onAskOpen: () => void }) {
  return (
    <div className="pd-textblock">
      <p className="pd-eyebrow">{slide.eyebrow ?? "Ask Anything"}</p>
      {slide.headline && <h2 className="pd-headline">{slide.headline}</h2>}
      {slide.body && <p className="pd-body">{slide.body}</p>}
      <div className="pd-ask-cta">
        <button type="button" className="pd-ask-button" onClick={onAskOpen} aria-label="Open Pulse Point">
          <PulseGlyph />
        </button>
        <span className="pd-ask-label">Tap to ask Pulse Point</span>
      </div>
    </div>
  );
}

function PulseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12h4l2-6 3 12 2.5-9 1.5 3h6" />
    </svg>
  );
}

/* ═══ Chrome: slide rail + Gate reentry overlay ═══ */

function SlideRail({
  count,
  activeIndex,
  onJump,
}: {
  count: number;
  activeIndex: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="pd-rail">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`pd-rail-dot${i === activeIndex ? " active" : ""}`}
          onClick={() => onJump(i)}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * "The Gate" is normally a stage inside front-door.tsx's in-memory pipeline
 * state (email plus access code entry), not a standalone route reachable by
 * experience id, so there's nothing to navigate to from here. Gravel-road
 * default: render a self-contained presenter view of that same screen,
 * built from the experience row already loaded server-side for this page,
 * good enough to show what a visitor saw without touching front-door.tsx
 * (out of scope) or re-running the pipeline.
 */
function GateOverlay({ experience, onClose }: { experience: Experience; onClose: () => void }) {
  return (
    <div className="pd-gate-overlay" onClick={onClose}>
      <div className="pd-gate-card" onClick={(e) => e.stopPropagation()}>
        <div className="pd-gate-mark">{experience.company_name ?? "Pulse"}</div>
        <div className="pd-gate-sub">The Gate, presenter view</div>
        <h2>This is the screen visitors saw to unlock this experience</h2>
        <p>
          Email plus access code. The pilot access code for this experience is <code>{experience.access_code}</code>.
        </p>
        <button type="button" className="pd-gate-close" onClick={onClose}>
          Back to the Experience
        </button>
      </div>
    </div>
  );
}
