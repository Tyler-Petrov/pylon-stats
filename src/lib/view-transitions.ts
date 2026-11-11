// Moving between pages, with the View Transitions API: the page cross-fades, a team's logo travels between a list
// and the team's own page, and whatever stays put (the nav, a team's header between its tabs) holds still. The
// CSS for it is at the end of routes/layout.css; movement within a page is lib/motion.ts.
import type { NavigationTarget, OnNavigate } from '$app/navigation';
import { prefersReducedMotion } from 'svelte/motion';

/**
 * Nothing on screen updates while the page swaps. The route loads (lib/warm.ts) have its data ready, so that takes
 * a few milliseconds; should it ever take longer than this, drop the animation rather than freeze the page.
 */
const MAX_FREEZE = 300;

// The browser drops the whole transition if two elements share a view-transition-name, and a team's logo can be on
// a page twice (a division rival is in the schedule twice). So names go on the elements that should travel, one
// each, only for as long as the transition runs.
let named: HTMLElement[] = [];

function name(el: Element | null | undefined, value: string) {
	if (!(el instanceof HTMLElement)) return;
	el.style.viewTransitionName = value;
	named.push(el);
}

function unname() {
	for (const el of named) el.style.viewTransitionName = '';
	named = [];
}

/** The team whose page this is, if it's a team page. */
const teamOf = (target: NavigationTarget | null) =>
	target?.route.id?.startsWith('/teams/[id=id]') ? (target.params?.id ?? null) : null;

function onScreen(el: Element) {
	const r = el.getBoundingClientRect();
	return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** The big logo in a team page's header. */
const hero = () => [...document.querySelectorAll('[data-team-hero]')].find(onScreen);

/** A team's small logo: the one in or beside the link that was clicked, else the first in view. */
function smallLogo(id: string, near?: Element | null) {
	const selector = `[data-team-logo="${CSS.escape(id)}"]`;
	// A game card puts the logo beside its link rather than in it.
	for (let scope = near, depth = 0; scope && depth < 3; scope = scope.parentElement, depth++) {
		const logo = scope.querySelector(selector);
		if (logo) return logo;
	}
	return [...document.querySelectorAll(selector)].find(onScreen);
}

/** Name what should travel, on one side of the transition. */
function nameShared(
	from: string | null,
	to: string | null,
	side: 'old' | 'new',
	near?: Element | null
) {
	if (from && from === to) {
		// Between a team's tabs, its header stays where it is.
		name(document.querySelector('[data-team-header]'), 'team-header');
	} else if (to) {
		// Onto a team's page, the logo that was clicked grows into the one in its header.
		name(side === 'old' ? smallLogo(to, near) : hero(), 'team-logo');
	} else if (from) {
		// And off it, back into the logo in the list.
		name(side === 'old' ? hero() : smallLogo(from), 'team-logo');
	}
}

let latest = 0;

/** For `onNavigate`: animate the page swap. */
export function transition(navigation: OnNavigate) {
	if (!document.startViewTransition || prefersReducedMotion.current) return;
	// Only between pages. A page that changes in place animates that itself.
	if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
	// A swipe back on a phone has animated the page already.
	if (navigation.type === 'popstate' && navigation.event.hasUAVisualTransition) return;

	const from = teamOf(navigation.from);
	const to = teamOf(navigation.to);
	const clicked = navigation.type === 'link' ? navigation.event.target : null;
	const id = ++latest;

	unname();
	nameShared(from, to, 'old', clicked instanceof Element ? clicked.closest('a') : null);

	return new Promise<void>((resolve) => {
		const vt = document.startViewTransition(async () => {
			// The old page is captured: let SvelteKit swap in the new one.
			resolve();
			const timer = setTimeout(() => vt.skipTransition(), MAX_FREEZE);
			try {
				await navigation.complete;
			} catch {
				// A newer navigation took over, or this one failed.
				vt.skipTransition();
				return;
			} finally {
				clearTimeout(timer);
			}
			unname();
			nameShared(from, to, 'new');
		});
		// A skipped transition rejects `ready`; the page just swaps without animating.
		vt.ready.catch(() => {});
		const done = () => id === latest && unname();
		vt.finished.then(done, done);
	});
}
