import { getGame, getPlays } from '#lib/nfl.remote.js';
import { gameTabOf } from '#lib/query.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// Picking a tab runs this again. When it's the plays, they come with the page, as a team's tabs do: which tab
// is open can depend on the game itself (one without a box score opens on its plays), so that waits for the game.
export const load: PageLoad = async ({ params, url }) => {
	const game = getGame(params.id);
	const queries = await warm(game);
	const tab = await Promise.resolve(game).then(
		(detail) => gameTabOf(detail, url),
		() => undefined
	);
	return {
		queries: tab === 'plays' ? [...queries, ...(await warm(getPlays(params.id)))] : queries
	};
};
