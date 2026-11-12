# Pylon

NFL scores, standings, schedules, depth charts and stats at https://pylon.tpetrov.dev. SvelteKit 3 + Svelte 5 (runes, async) + Tailwind 4 + shadcn-svelte, served by the `pylon-stats` Cloudflare Worker (adapter-cloudflare). No backend of its own: data is ESPN's public site API, which is unofficial, so when something breaks the fix belongs in `espn.ts`.

- All ESPN-specific parsing stays in `src/lib/server/espn.ts`; components only see `src/lib/types.ts`. It caches responses in memory (20s for scores, up to 6h for the team list) and serves the last good response when ESPN fails.
- Pages and components `await` remote functions from `src/lib/nfl.remote.ts`. Wrap anything that loads separately from its page in a `<svelte:boundary>` with a `pending` snippet.
- Pages render in the browser (`ssr = false`) so kickoff times use the visitor's time zone.
- Links go through `resolve()` (lint enforces it). Route params use the matchers in `src/params.ts`.
- Dark only. Palette and fonts live in `src/routes/layout.css`; pages tint themselves with `--team`.
- Open pages move onto a new release by themselves (root layout, `version` in `vite.config.ts`).
- Run `pnpm check` and `pnpm lint` before calling a change done.

## Code changes and releases

Make code changes on a separate branch in a worktree and integrate them through pull requests against `main`. Push a draft PR against `main` as soon as you start making code changes, without asking, and link it to the thread. CI runs `pnpm check`, `pnpm lint` and `pnpm build` on every PR. Release only with `pnpm release`, which deploys main through GitHub Actions; never run `wrangler deploy` directly.

T3 Code runs `scripts/worktree-setup.sh` automatically in the worktrees it creates. If you create a worktree manually, run `. scripts/worktree-setup.sh` from its root.

PR previews are opt-in: add the `deploy-preview` label to the PR, and each push comments a `pr-<number>` preview URL.

## Dev server

`pnpm dev` starts this worktree's background dev server on a free port and prints its local and Tailscale URLs. `pnpm dev restart` and `pnpm dev stop` do what they say, `pnpm dev servers` lists every worktree's, and its output is in `.dev-server.log`. It stops 30 seconds after nothing is watching it. Start, restart, or stop it whenever you need to.
