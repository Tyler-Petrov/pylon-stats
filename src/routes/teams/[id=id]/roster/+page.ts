import { getRoster } from '#lib/nfl.remote.js';
import { warm } from '#lib/warm.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ queries: await warm(getRoster(params.id)) });
