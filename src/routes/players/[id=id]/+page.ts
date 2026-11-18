import { getCareer, getGameLog, getPlayer } from '#lib/nfl.remote.js';
import { seasonOf } from '#lib/query.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// Reading the season from the address runs this again when another one is picked, so that season's games are in
// hand before the page changes.
export const load: PageLoad = async ({ params, url }) => ({
	queries: await warm(
		getPlayer(params.id),
		getCareer(params.id),
		getGameLog({ id: params.id, season: seasonOf(url) })
	)
});
