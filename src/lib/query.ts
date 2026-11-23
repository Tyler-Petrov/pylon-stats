// What a page's own address asks for: `?category=rushing&sort=rushing.rushingTouchdowns`. A route's
// `load` and its page both read it here, so they ask the remote function for exactly the same thing (lib/warm.ts).
// Anything in the address that makes no sense is as good as left out, so a hand-edited one still shows a page.

import type { GameDetail } from './types.js';

/** A page's address: `page.url`, or the `url` a `load` is given. */
type Address = { searchParams: { get(name: string): string | null } };

/** The seasons the remote functions (lib/nfl.remote.ts) will take. */
export const SEASONS = { min: 1920, max: 2100 };

/** "passing.passingYards": a stat group and a stat in it, as the columns of a leaders table name them. */
export const SORT = /^[A-Za-z]{1,30}\.[A-Za-z0-9_]{1,40}$/;

export function leadersOf(url: Address) {
	const sort = url.searchParams.get('sort');
	return {
		category: url.searchParams.get('category')?.slice(0, 20) || undefined,
		sort: sort && SORT.test(sort) ? sort : undefined
	};
}

/** A game page's tabs. */
export type GameTab = 'box' | 'plays' | 'stats' | 'scoring';

/**
 * The tabs a game has something in, in the order the page shows them, each with a shorter name for a phone. Before
 * kickoff that's only the season averages. The plays come from the drives, not the box score, so a game ESPN has
 * no box score for can still have them.
 */
export function gameTabs(game: GameDetail) {
	const on = game.state !== 'pre';
	return (
		[
			{ key: 'box', label: 'Box score', short: 'Box score', shown: game.boxScore.length > 0 },
			{ key: 'plays', label: 'Play-by-play', short: 'Plays', shown: on },
			{
				key: 'stats',
				label: game.teamStats.title,
				short: on ? 'Team stats' : 'Averages',
				shown: game.teamStats.rows.length > 0
			},
			{ key: 'scoring', label: 'Scoring', short: 'Scoring', shown: on }
		] satisfies { key: GameTab; label: string; short: string; shown: boolean }[]
	).filter((tab) => tab.shown);
}

/** The tab a game page's address asks for, `?tab=plays`. Without one, or one the game hasn't got, its first. */
export function gameTabOf(game: GameDetail, url: Address): GameTab | undefined {
	const tabs = gameTabs(game);
	const asked = url.searchParams.get('tab');
	return (tabs.find(({ key }) => key === asked) ?? tabs[0])?.key;
}
