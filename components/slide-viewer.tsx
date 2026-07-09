"use client";

import { useEffect, useState } from "react";
import type { Slide } from "@/types/database";
import { logAnalyticsEvent } from "@/lib/data/analytics";

export function SlideViewer({
  experienceId,
  slides,
}: {
  experienceId: string;
  slides: Slide[];
}) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  useEffect(() => {
    logAnalyticsEvent(experienceId, "view", slide.id);
  }, [experienceId, slide.id]);

  function goNext() {
    if (isLast) {
      logAnalyticsEvent(experienceId, "complete", slide.id);
      return;
    }
    setIndex((i) => i + 1);
  }

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1">
        <SlideContent slide={slide} />
      </div>

      <footer className="flex items-center justify-between border-t border-neutral-200 p-4 dark:border-neutral-800">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="rounded-md px-3 py-1.5 text-sm disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="text-xs text-neutral-500">
          {index + 1} / {slides.length}
        </span>
        <button
          onClick={goNext}
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          {isLast ? "Finish" : "Next →"}
        </button>
      </footer>
    </main>
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.layout_type) {
    case "media_full":
      return (
        <div className="relative flex h-full min-h-[60vh] items-end bg-black">
          {slide.video_url && (
            <video
              src={slide.video_url}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
            />
          )}
          <div className="relative z-10 p-8 text-white">
            {slide.eyebrow && (
              <p className="mb-2 text-sm uppercase tracking-wide opacity-80">
                {slide.eyebrow}
              </p>
            )}
            {slide.headline && (
              <h2 className="text-3xl font-semibold">{slide.headline}</h2>
            )}
          </div>
        </div>
      );

    case "split":
    case "three_quarter":
      return (
        <div
          className={`grid min-h-[60vh] gap-6 p-8 ${
            slide.layout_type === "split" ? "grid-cols-2" : "grid-cols-4"
          }`}
        >
          <div
            className={
              slide.layout_type === "split" ? "col-span-1" : "col-span-3"
            }
          >
            {slide.eyebrow && (
              <p className="mb-2 text-sm uppercase tracking-wide text-neutral-500">
                {slide.eyebrow}
              </p>
            )}
            {slide.headline && (
              <h2 className="mb-4 text-2xl font-semibold">{slide.headline}</h2>
            )}
            {slide.body && <p className="text-neutral-700 dark:text-neutral-300">{slide.body}</p>}
            {slide.sig && <p className="mt-4 text-sm italic">{slide.sig}</p>}
          </div>
          <div className="col-span-1 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
            {slide.video_url ? (
              <video src={slide.video_url} className="h-full w-full object-cover" controls />
            ) : (
              <span className="text-xs text-neutral-400">No media</span>
            )}
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="min-h-[60vh] p-8">
          {slide.headline && (
            <h2 className="mb-6 text-2xl font-semibold">{slide.headline}</h2>
          )}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {(Array.isArray(slide.items) ? slide.items : []).map(
              (item: unknown, i: number) => (
                <div key={i} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(item, null, 2)}
                  </pre>
                </div>
              )
            )}
          </div>
        </div>
      );

    case "waveform":
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
          {slide.headline && (
            <h2 className="text-2xl font-semibold">{slide.headline}</h2>
          )}
          {slide.body && <p className="max-w-lg text-center text-neutral-600 dark:text-neutral-400">{slide.body}</p>}
          {slide.audio_url && <audio src={slide.audio_url} controls className="mt-4" />}
        </div>
      );

    case "text_only":
    default:
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          {slide.eyebrow && (
            <p className="text-sm uppercase tracking-wide text-neutral-500">
              {slide.eyebrow}
            </p>
          )}
          {slide.headline && <h2 className="text-3xl font-semibold">{slide.headline}</h2>}
          {slide.body && (
            <p className="max-w-xl text-neutral-700 dark:text-neutral-300">{slide.body}</p>
          )}
          {slide.sig && <p className="text-sm italic">{slide.sig}</p>}
        </div>
      );
  }
}
