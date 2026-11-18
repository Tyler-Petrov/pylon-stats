import { getCareer, getGameLog, getPlayer } from '#lib/nfl.remote.js';
import { season } from '#lib/season.svelte.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

/** How long the page waits on the games before going ahead without them. */
const GAMES_WAIT = 400;

export const load: PageLoad = async ({ params }) => {
	// The games are extra to the page (lib/components/player/games.svelte). They nearly always arrive with the
	// rest; a slow game log isn't waited for, and fills in under the stats when it comes.
	const games = getGameLog({ id: params.id, season: season.picked });
	const [queries] = await Promise.all([
		warm(getPlayer(params.id), getCareer(params.id)),
		Promise.race([warm(games), new Promise((done) => setTimeout(done, GAMES_WAIT))])
	]);
	return { queries: [...queries, games] };
};
