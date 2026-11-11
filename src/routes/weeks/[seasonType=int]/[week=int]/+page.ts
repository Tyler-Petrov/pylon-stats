import { getScoreboard } from '#lib/nfl.remote.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({
	queries: await warm(getScoreboard({ week: params.week, seasonType: params.seasonType }))
});
