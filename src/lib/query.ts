// What a page's own address asks for: `?category=rushing&sort=rushing.rushingTouchdowns`. A route's
// `load` and its page both read it here, so they ask the remote function for exactly the same thing (lib/warm.ts).
// Anything in the address that makes no sense is as good as left out, so a hand-edited one still shows a page.

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

/** A game page's tabs, in the order it shows them. */
export const GAME_TABS = ['box', 'plays', 'stats', 'scoring'] as const;
export type GameTab = (typeof GAME_TABS)[number];

/** The tab a game page's address asks for: `?tab=plays`. Without one, the page shows its first. */
export function gameTabOf(url: Address): GameTab | undefined {
	const tab = url.searchParams.get('tab');
	return GAME_TABS.find((key) => key === tab);
}
