# Pylon

NFL scores, standings, schedules, depth charts and stats. A SvelteKit app over ESPN's public site API: no key, no database.

**Live:** https://pylon-stats.tyler-f8b.workers.dev

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm check        # svelte-check + types
pnpm lint         # prettier + eslint
pnpm run deploy   # build and deploy to Cloudflare Workers (needs `wrangler login`)
```

## Pages

| Route                          | What                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `/`                            | This week's scoreboard. Refreshes every 30s while games are live. |
| `/weeks/[seasonType]/[week]`   | Any week (`seasonType` 2 = regular season, 3 = playoffs)          |
| `/teams`                       | All 32 teams by conference and division (not linked in the nav)   |
| `/teams/[id]`                  | Team header, schedule (with the bye)                              |
| `/teams/[id]/roster`, `/stats` | Depth chart with injuries, then reserves; team stats              |
| `/players/[id]`                | Bio, season and career lines, game log                            |
| `/standings`                   | Division tables with playoff seeds                                |

## How data flows

- `src/lib/server/espn.ts` is the only file that knows ESPN's JSON. It maps everything into the types in `src/lib/types.ts` and caches responses in memory (20s for scores, up to 6h for the team list).
- `src/lib/nfl.remote.ts` exposes those as remote functions (`query`), which pages `await` directly.
- Pages render in the browser (`ssr = false`) so kickoff times use the visitor's time zone.

The ESPN API is unofficial. If something breaks, the fix belongs in `espn.ts`.

## Stack

SvelteKit 3 with remote functions and async Svelte, Svelte 5 runes, Tailwind 4, shadcn-svelte, deployed to Cloudflare Workers with `@sveltejs/adapter-cloudflare`.

## License

MIT. Pylon isn't affiliated with or endorsed by the NFL or ESPN; team names, logos and data belong to their owners.
