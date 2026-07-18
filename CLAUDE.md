# Pulse 3.0

Full build spec: see the master build prompt supplied at project kickoff (Pulse 3.0
Master Build Prompt). Follow it exactly for terminology, schema, API routes, and
build order.

## Gravel road philosophy — do not stop and wait on ambiguity

While building, follow the gravel road philosophy already defined in this
project's master prompt: never stop and wait for a product decision. If
something is ambiguous, choose the most reasonable default consistent with
the rest of this document, implement it, write a one-line note in
`build_mocks` or a code comment explaining the call, and continue. Treat this
as equivalent to a mocked integration: a decision made now that a human can
revisit later, not a blocker.

Check in with a summary after each numbered phase completes rather than after
every file. Only stop outright for what settings.json already routes to
"ask": pushing to a remote, editing environment files, editing package.json
or the Supabase config, or anything that would spend real money on a paid
API beyond the keys already in .env.

## Locked terminology — never deviate

- **Digital Replicas**: REViiZED-rendered talking heads. Never "avatars."
- **Pulse Point**: the persistent icon, lower right. Never "chat bubble" or "bot."
- **The Gate**: email plus access code entry.
- **Pulse Check**: the analytics dashboard.
- **The Stitch**: final pipeline assembly.
- **The Intelligence Loop**: the analysis pipeline.
- **Replica Studio**: the Admin surface for scripting a person and queuing their REViiZED job.
- **Gravel Road**: any feature stubbed with labeled mock data, not yet wired.
- **Slide**: never "frame" in user-facing copy.
- The word "AI" is banned from all user-facing UI copy. Use "Generate" or
  "Generate media." Exception: a company's own name is always written exactly
  as the company writes it.
- Never reproduce logos, wordmarks, icon marks, or any trademarked brand
  assets. Brand identity is conveyed exclusively through color, typography,
  heading case, layout rhythm, button shape, and imagery style.

## Hard-won lessons — do not relearn these

1. Forced tool calls, never free-text JSON, for structured Claude output.
2. Per-slide and per-module generation calls, not one giant response.
3. Re-host every scraped image to Supabase Storage. Hotlinked headshots die on CDN blocks.
4. Never resolve a stale foreign-key id through a forgiving fallback (e.g. "first profile").
   Check membership explicitly; anchor durable selections (like a narrator) by name, not id.
5. Give overlay UI (like the live interview room) its own real width; don't nest it in a
   generic narrower shared container.
6. Never send third-party username/password credentials from the client. Any JWT exchange
   (REViiZED, etc.) stays server-side, full stop.
