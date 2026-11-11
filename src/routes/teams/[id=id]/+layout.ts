import { getStandings, getTeam } from '#lib/nfl.remote.js';
import { warm, warmImage } from '#lib/warm.js';
import type { LayoutLoad } from './$types';

// Standings are for the division table, and the opponents' records in the schedule.
export const load: LayoutLoad = async ({ params }) => {
	const team = getTeam(params.id);
	const teamQueries = await warm(team, getStandings());
	await team.then(
		(t) => warmImage(t.logo),
		() => {}
	);
	return { teamQueries };
};
