/*
 * Pages `await` their remote queries while they render, which SvelteKit only starts once it commits to the new
 * page. Each route's `load` starts the same queries first, so the data is in hand before the page swaps in:
 * the old page stays usable meanwhile, and the view transition (lib/view-transitions.ts) never waits on ESPN.
 * Hovering a link runs its `load` too, so the data is often there before the click.
 */

/**
 * Start a page's queries ahead of its render. Call them with exactly the arguments the page does, or it asks
 * again. A failure is left for the page's own boundary to show.
 *
 * Return the result from `load`: the client drops cached queries once nothing refers to them.
 */
export async function warm(...queries: PromiseLike<unknown>[]) {
	await Promise.allSettled(queries);
	return queries;
}
