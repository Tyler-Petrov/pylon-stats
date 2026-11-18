import { getLeaders } from '#lib/nfl.remote.js';
import { leadersOf } from '#lib/query.js';
import { season } from '#lib/season.svelte.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// Reading the address runs this again for each category and sort picked, so the next table is in hand before the
// page changes.
export const load: PageLoad = async ({ url }) => ({
	queries: await warm(getLeaders({ ...leadersOf(url), season: season.picked }))
});
