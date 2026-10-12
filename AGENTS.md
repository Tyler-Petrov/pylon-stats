# Pylon

SvelteKit 3 + Svelte 5 (runes, async) + Tailwind 4 + shadcn-svelte, deployed with adapter-cloudflare. No backend of its own: data is ESPN's public site API.

- All ESPN-specific parsing stays in `src/lib/server/espn.ts`; components only see `src/lib/types.ts`.
- Pages and components `await` remote functions from `src/lib/nfl.remote.ts`. Wrap anything that loads separately from its page in a `<svelte:boundary>` with a `pending` snippet.
- Links go through `resolve()` (lint enforces it). Route params use the matchers in `src/params.ts`.
- Dark only. Palette and fonts live in `src/routes/layout.css`; pages tint themselves with `--team`.
- Run `pnpm check` and `pnpm lint` before calling a change done.
