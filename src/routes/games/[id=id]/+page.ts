import { getGame, getPlays } from '#lib/nfl.remote.js';
import { gameTabOf } from '#lib/query.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// Picking a tab runs this again, so the plays are in hand before their tab shows.
export const load: PageLoad = async ({ params, url }) => ({
	queries: await warm(
		getGame(params.id),
		...(gameTabOf(url) === 'plays' ? [getPlays(params.id)] : [])
	)
});
