import { getScoreboard } from '#lib/nfl.remote.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// The same arguments the scoreboard passes for the current week, so it finds this request in the cache.
export const load: PageLoad = async () => ({
	queries: await warm(getScoreboard({ week: undefined, seasonType: undefined }))
});
