import { getStandings } from '#lib/nfl.remote.js';
import { season } from '#lib/season.svelte.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ queries: await warm(getStandings(season.picked)) });
