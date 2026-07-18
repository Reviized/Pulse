"use client";

import "@/app/styles/admin.css";

/**
 * Route-segment error boundary for /admin/*. Catches anything thrown by a
 * page or nested layout under this segment (not app/admin/layout.tsx
 * itself, Next.js excludes the same-segment layout — that call site is
 * guarded directly in layout.tsx). Renders in-brand instead of Next's
 * generic crash screen, per the gravel road philosophy: an honest error
 * state, not a dead end.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pulse-admin">
      <div className="pa-shell">
        <main className="pa-main">
          <div className="pa-eyebrow">Admin</div>
          <h1 className="pa-h1">Something broke on this page</h1>
          <div className="pa-card" style={{ borderColor: "rgba(217,122,122,.4)" }}>
            <div className="pa-status-reason" style={{ color: "var(--bad)", fontSize: 12.5 }}>
              {error.message || "Unknown error"}
            </div>
          </div>
          <div className="pa-btn-row" style={{ marginTop: 18 }}>
            <button className="pa-btn" onClick={reset}>
              Try again
            </button>
            <a className="pa-btn ghost" href="/admin/build-status">
              Build Status
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
