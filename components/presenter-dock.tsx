"use client";

/**
 * Presenter navigation dock (Section 9: "Presenter navigation"). A
 * persistent, always-reachable bar so Pulse can be demoed live without ever
 * hitting a dead end: Front Door, The Gate, Experience, Admin, plus a full
 * restart. Low-contrast until hovered so it never competes with the deck
 * content (CSS: .pd-dock in app/styles/deck.css).
 *
 * Gravel-road note on "Front Door" vs "Restart": the full build envisions a
 * single in-memory SPA state machine where jumping between screens never
 * discards content (Section 9). This build is a multi-page Next.js app, so
 * that distinction is implemented as: "Front Door" is a normal client-side
 * navigation to "/", while "Restart" is a hard reload to "/" that guarantees
 * every piece of local state is torn down (any open Pulse Point panel, any
 * playing/looping media) rather than trusting component unmounts to do it,
 * matching Section 9's "tear all three down cleanly before switching" rule
 * in spirit even though there's no live interview mounted on this route.
 *
 * "Admin" links to /admin regardless of whether that route exists yet —
 * another agent owns app/admin/**; if it hasn't landed yet this 404s
 * gracefully rather than blocking the dock on a build-order dependency.
 */
export function PresenterDock({
  onShowGate,
  onJumpExperience,
}: {
  onShowGate: () => void;
  onJumpExperience: () => void;
}) {
  return (
    <nav className="pd-dock" aria-label="Presenter navigation">
      <a className="pd-dock-btn" href="/">
        Front Door
      </a>
      <span className="pd-dock-div" />
      <button type="button" className="pd-dock-btn" onClick={onShowGate}>
        The Gate
      </button>
      <span className="pd-dock-div" />
      <button type="button" className="pd-dock-btn" onClick={onJumpExperience}>
        Experience
      </button>
      <span className="pd-dock-div" />
      <a className="pd-dock-btn" href="/admin">
        Admin
      </a>
      <span className="pd-dock-div" />
      <button
        type="button"
        className="pd-dock-btn restart"
        onClick={() => {
          window.location.href = "/";
        }}
      >
        Restart
      </button>
    </nav>
  );
}
