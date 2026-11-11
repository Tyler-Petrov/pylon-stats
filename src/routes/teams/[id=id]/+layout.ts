import { getStandings, getTeam } from '#lib/nfl.remote.js';
import { warm, warmImage } from '#lib/warm.js';
import type { LayoutLoad } from './$types';

// Standings are for the division table, and the opponents' records in the schedule.
export const load: LayoutLoad = async ({ params }) => {
	const teamQueries = await warm(getTeam(params.id), getStandings());
	await getTeam(params.id).then(
		(team) => warmImage(team.logo),
		() => {}
	);
	return { teamQueries };
};
