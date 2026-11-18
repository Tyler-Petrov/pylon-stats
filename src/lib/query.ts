// What a page's own address asks for: `?season=2023`, `?category=rushing&sort=rushing.rushingTouchdowns`. A route's
// `load` and its page both read it here, so they ask the remote function for exactly the same thing (lib/warm.ts).
// Anything in the address that makes no sense is as good as left out, so a hand-edited one still shows a page.

/** A page's address: `page.url`, or the `url` a `load` is given. */
type Address = { searchParams: { get(name: string): string | null } };

/** The seasons a page can be asked for. The remote functions (lib/nfl.remote.ts) hold to the same range. */
export const SEASONS = { min: 1920, max: 2100 };

/** "passing.passingYards": a stat group and a stat in it, as the columns of a leaders table name them. */
export const SORT = /^[A-Za-z]+\.[A-Za-z0-9_]+$/;

export function seasonOf(url: Address) {
	const season = Number(url.searchParams.get('season'));
	return Number.isInteger(season) && season >= SEASONS.min && season <= SEASONS.max
		? season
		: undefined;
}

export function leadersOf(url: Address) {
	const sort = url.searchParams.get('sort');
	return {
		category: url.searchParams.get('category')?.slice(0, 20) || undefined,
		sort: sort && SORT.test(sort) ? sort : undefined,
		season: seasonOf(url)
	};
}

/** What's being searched for. Under two letters is nothing to search on. */
export function searchOf(url: Address) {
	const text = (url.searchParams.get('q') ?? '').trim().slice(0, 40);
	return text.length >= 2 ? text : '';
}
