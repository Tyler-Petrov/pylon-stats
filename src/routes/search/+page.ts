import { getSearchResults } from '#lib/nfl.remote.js';
import { searchOf } from '#lib/query.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

// Reading the address runs this again for each thing searched, so the results are in hand before the list changes:
// the last results stay up meanwhile, and the box is never waiting on them.
export const load: PageLoad = async ({ url }) => {
	const query = searchOf(url);
	return { queries: query ? await warm(getSearchResults(query)) : [] };
};
