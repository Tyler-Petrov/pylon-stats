// Movement within a page: indicators that slide, cards that move, images that fade in. Moving between pages
// is lib/view-transitions.ts. Everything here stands still for anyone who asked for reduced motion.
import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import { crossfade, fade } from 'svelte/transition';

/** How long a movement takes: quick enough to keep up with a click, slow enough to follow. */
export const duration = (ms = 250) => (prefersReducedMotion.current ? 0 : ms);

/**
 * A pair of transitions that slide one indicator (the active tab, the selected week) from where it was to where
 * it is: `{#if active}<span in:receive={{ key }} out:send={{ key }}></span>{/if}`. With nothing to slide from,
 * it fades. Each set of tabs needs its own pair.
 */
export function indicator() {
	const [send, receive] = crossfade({
		duration: () => duration(),
		easing: cubicOut,
		fallback: (node) => fade(node, { duration: duration(150) })
	});
	// Tabs that aren't shown at this screen width have no size to slide between, and Svelte would divide by it.
	const shown =
		(transition: typeof send): typeof send =>
		(node, params) =>
			node.getClientRects().length ? transition(node, params) : () => ({ duration: 0 });
	return [shown(send), shown(receive)] as const;
}

/**
 * `animate:move`: a keyed item glides to its new place when the list reorders. Svelte's `flip` also scales, which
 * squashes the text of a card that changes height as it moves; this only translates.
 */
export function move(node: Element, { from, to }: { from: DOMRect; to: DOMRect }) {
	const dx = from.left - to.left;
	const dy = from.top - to.top;
	return {
		duration: dx || dy ? duration(300) : 0,
		easing: cubicOut,
		css: (_t: number, u: number) => `transform: translate(${u * dx}px, ${u * dy}px)`
	};
}

/**
 * `{@attach fadeIn}` on an `<img>`: it fades in once loaded rather than popping in. One the browser already had
 * shows at once, so a page you come back to doesn't flicker.
 */
export function fadeIn(img: HTMLImageElement) {
	if (img.complete || prefersReducedMotion.current) return;
	img.style.opacity = '0';
	const show = () => {
		img.style.transition = `opacity ${duration(200)}ms ease-out`;
		img.style.opacity = '';
	};
	img.addEventListener('load', show, { once: true });
	img.addEventListener('error', show, { once: true });
	return () => {
		img.removeEventListener('load', show);
		img.removeEventListener('error', show);
	};
}
