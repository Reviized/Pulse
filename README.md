# Pulse

Next.js 14 (App Router) + TypeScript + Tailwind, backed by the existing Bolt
Database (Supabase) project, ref `vcyyyaannoeuuswohlvf`.

## Status

Phase 1 (frontend core) scaffold: experience list/create/detail pages and the
FrontDoor slide viewer. See `/root/.claude/plans/purrfect-frolicking-goose.md`
in the session this was built in for the full plan.

Two things are still blocking a live end-to-end run:

1. **Edge function source is not yet in this repo.** The 14 deployed
   functions (`pulse-experiences`, `pulse-brief`, `pulse-slides-generate`,
   etc.) live only on the Supabase project. `lib/api/pulse-experiences.ts`
   calls `pulse-experiences` directly by URL, but its request/response
   contract is a best guess pending `supabase functions download`.
2. **`types/database.ts` is hand-derived**, not generated from the live
   schema (`supabase gen types typescript`), for the same reason.

Both need `supabase login` (personal access token) and network access to
`vcyyyaannoeuuswohlvf.supabase.co` / `api.supabase.com`, which are not
available in the sandbox this was built in.

## Development

```bash
npm install
cp .env.example .env.local  # fill in from the Bolt backend report
npm run dev
```
