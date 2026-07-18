"use client";

import { useCallback, useEffect, useRef } from "react";
import type { AnalyticsEventName } from "@/types/database";

type QueuedEvent = { event: AnalyticsEventName; slideRef?: string; value?: number };

const FLUSH_INTERVAL_MS = 10_000;

/**
 * Client-side batched analytics queue (Section 6, item 15: "dwell batched
 * client-side, flush every 10s"; CLAUDE.md hard-won lesson 3 / Section 11
 * lesson 6: "batch analytics writes, per-scroll writes melted storage").
 *
 * This replaces the previous logAnalyticsEvent, which inserted directly into
 * `analytics_events` from the browser using the anon Supabase client — every
 * write in the schema is service-role-only per Section 5's RLS rules, so
 * those inserts were being silently rejected by RLS on every call. Events
 * now queue in a ref and flush to POST /api/track (which writes via the
 * admin/service-role client) on a 10s interval, and again on unmount or when
 * the tab is hidden/closed via sendBeacon so nothing queued is lost.
 */
export function useAnalyticsQueue(experienceId: string, sessionKey: string) {
  const queueRef = useRef<QueuedEvent[]>([]);

  const track = useCallback((event: AnalyticsEventName, slideRef?: string, value?: number) => {
    queueRef.current.push({ event, slideRef, value });
  }, []);

  const flush = useCallback(
    (useBeacon = false) => {
      if (queueRef.current.length === 0) return;
      const events = queueRef.current;
      queueRef.current = [];
      const payload = JSON.stringify({ experienceId, sessionKey, events });

      if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        const sent = navigator.sendBeacon("/api/track", blob);
        if (sent) return;
      }

      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Best-effort only — a dropped analytics batch must never break the
        // deck (CLAUDE.md: analytics is fire-and-forget, non-blocking).
      });
    },
    [experienceId, sessionKey]
  );

  useEffect(() => {
    const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [flush]);

  return { track, flush };
}
