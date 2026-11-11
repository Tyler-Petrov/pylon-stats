// Moving between pages, with the View Transitions API: the page cross-fades, a team's logo travels between a list
// and the team's own page, and whatever stays put (the nav, a team's header between its tabs, the week strip)
// holds still. The CSS for it is at the end of routes/layout.css; movement within a page is lib/motion.ts.
import type { NavigationTarget, OnNavigate } from '$app/navigation';
import { prefersReducedMotion } from 'svelte/motion';

/**
 * Nothing on screen updates while the page swaps. The route loads (lib/warm.ts) have its data ready, so that takes
 * a few milliseconds; should it ever take longer than this, drop the animation rather than freeze the page.
 */
const MAX_FREEZE = 300;

const WEEK = '/weeks/[seasonType=int]/[week=int]';

// The browser drops the whole transition if two elements share a view-transition-name, and a team's logo can be on
// a page twice (a division rival is in the schedule twice). So names go on the elements that should travel, one
// each, only for as long as the transition runs. Anything named on one side only fades with the page.
let named: HTMLElement[] = [];

function name(el: Element | null | undefined, value: string) {
	if (!(el instanceof HTMLElement)) return;
	// An image that hasn't loaded would travel as an empty box.
	if (el instanceof HTMLImageElement && !(el.complete && el.naturalWidth)) return;
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

/** The first element matching `selector` that's in view: one scrolled away would fly in from off screen. */
const inView = (selector: string) => [...document.querySelectorAll(selector)].find(onScreen);

/** A team's small logo: the one in or beside the link that was clicked, else the first in view. */
function smallLogo(id: string, near?: Element | null) {
	const selector = `[data-team-logo="${CSS.escape(id)}"]`;
	// A game card puts the logo beside its link rather than in it.
	for (let scope = near, depth = 0; scope && depth < 3; scope = scope.parentElement, depth++) {
		const logo = scope.querySelector(selector);
		if (logo) return logo;
	}
	return inView(selector);
}

/** Name what should travel or hold still, on one side of the transition. */
function nameShared(navigation: OnNavigate, side: 'old' | 'new', near?: Element | null) {
	const from = teamOf(navigation.from);
	const to = teamOf(navigation.to);
	if (navigation.from?.route.id === WEEK && navigation.to?.route.id === WEEK) {
		// Between weeks, the strip stays where it is while its pill slides along it.
		name(document.querySelector('[data-week-strip]'), 'week-strip');
	}
	if (from && from === to) {
		// Between a team's tabs, its header stays where it is and the underline slides to the new tab.
		name(document.querySelector('[data-team-header]'), 'team-header');
		name(document.querySelector('[data-team-tab]'), 'team-tab');
		return;
	}
	if (from && to) {
		// Team to team, the highlighted row of the division table moves to the new team's.
		name(inView('[data-division-team]'), 'division-team');
	}
	if (to) {
		// Onto a team's page, the logo that was clicked grows into the one in its header.
		name(side === 'old' ? smallLogo(to, near) : inView('[data-team-hero]'), 'team-logo');
	} else if (from) {
		// And off it, back into the logo in the list.
		name(side === 'old' ? inView('[data-team-hero]') : smallLogo(from), 'team-logo');
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

	const clicked = navigation.type === 'link' ? navigation.event.target : null;
	const id = ++latest;

	unname();
	nameShared(navigation, 'old', clicked instanceof Element ? clicked.closest('a') : null);

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
			nameShared(navigation, 'new');
		});
		// A skipped transition rejects `ready`; the page just swaps without animating.
		vt.ready.catch(() => {});

		// While it runs, the transition takes every click for itself. Rather than lose one (a second week picked
		// in quick succession), pass it on to whatever is under the pointer once the transition is over.
		const hold = (event: MouseEvent) => {
			if (event.target !== document.documentElement) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const pass = () => {
				const target = document.elementFromPoint(event.clientX, event.clientY);
				if (target instanceof HTMLElement && target !== document.documentElement) target.click();
			};
			vt.finished.then(pass, pass);
		};
		document.addEventListener('click', hold, { capture: true });

		const done = () => {
			document.removeEventListener('click', hold, { capture: true });
			if (id === latest) unname();
		};
		vt.finished.then(done, done);
	});
}
