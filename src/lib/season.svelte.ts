// The season the whole app is showing: scores, standings, the Players table, a player's stats. It's picked at
// the bottom of the sidebar (lib/components/season-picker.svelte) and kept for the visit, so a reload stays in
// the season you were looking at and a new visit starts in the current one.
import { getSeasons } from '#lib/nfl.remote.js';

const KEY = 'pylon:season';

function remembered() {
	try {
		return Number(sessionStorage.getItem(KEY)) || undefined;
	} catch {
		// Storage can be switched off; the season then lasts as long as the page does.
		return undefined;
	}
}

let picked = $state<number | undefined>(remembered());

// The seasons there are to pick from, the current one first. Asked for once, the first time something wants them:
// the picker sits in the frame around every page, and reading the query there without awaiting it lost it.
let all = $state<number[]>([]);
let asked = false;
function load() {
	if (asked) return;
	asked = true;
	getSeasons().then(
		(list) => (all = list),
		() => (asked = false)
	);
}

export const season = {
	/** Every season there is to pick, the current one first. Empty until it has loaded. */
	get all() {
		load();
		return all;
	},
	/** The season picked, or undefined for the current one. Remote functions take it as it is. */
	get picked() {
		return picked;
	},
	set picked(year: number | undefined) {
		picked = year;
		try {
			if (year) sessionStorage.setItem(KEY, String(year));
			else sessionStorage.removeItem(KEY);
		} catch {
			// See above.
		}
	}
};
