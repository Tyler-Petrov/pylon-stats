<script lang="ts">
	import type { Snippet } from 'svelte';
	import { navigating, page } from '$app/state';
	import { resolve } from '$app/paths';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Shield from '@lucide/svelte/icons/shield';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import { cn } from '#lib/utils.js';
	import { indicator } from '#lib/motion.js';
	import Wordmark from './wordmark.svelte';

	let { children }: { children: Snippet } = $props();

	// The highlight behind the active tab slides to the next one. The sidebar and the phone's tab bar each have
	// their own, since only one of them is on screen.
	const [sendSide, receiveSide] = indicator();
	const [sendBar, receiveBar] = indicator();

	const tabs = [
		{ href: resolve('/'), label: 'Scores', icon: Trophy },
		// Hidden: Standings lists every team too, so this page is out of the nav for now. The route still works.
		{ href: resolve('/teams'), label: 'Teams', icon: Shield, hidden: true },
		{ href: resolve('/standings'), label: 'Standings', icon: ListOrdered }
	].filter((tab) => !tab.hidden);

	// The tab being navigated to lights up on click, not when its page has rendered.
	const path = $derived((navigating.to?.url ?? page.url).pathname);

	function isActive(href: string) {
		// Any week's scores belong under Scores.
		if (href === resolve('/')) return path === href || path.startsWith('/weeks');
		// A player's page belongs under Teams, where you find players.
		if (href === resolve('/teams')) return path.startsWith(href) || path.startsWith('/players');
		// With Teams hidden, team and player pages belong under Standings, where you find teams.
		if (href === resolve('/standings'))
			return path.startsWith(href) || path.startsWith('/teams') || path.startsWith('/players');
		return path.startsWith(href);
	}
</script>

<div class="min-h-dvh md:grid md:grid-cols-[13rem_1fr]">
	<!-- Both navs are named for the view transition (routes/layout.css), so they hold still while the page
	     cross-fades. -->
	<nav
		aria-label="Main"
		data-sveltekit-preload-code="eager"
		class="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-border bg-sidebar p-3 [view-transition-name:sidebar] md:flex"
	>
		<a href={resolve('/')} class="mb-6 px-3 pt-2">
			<Wordmark class="text-[1.65rem]" />
		</a>
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class={cn(
					'relative isolate flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground',
					active && 'text-foreground'
				)}
			>
				{#if active}
					<span
						in:receiveSide={{ key: 'active' }}
						out:sendSide={{ key: 'active' }}
						class="absolute inset-0 -z-10 rounded-lg bg-accent"
					></span>
				{/if}
				<tab.icon class={cn('size-4 transition-colors', active && 'text-pylon')} />
				{tab.label}
			</a>
		{/each}
	</nav>

	<main class="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-12">
		{@render children()}
		<footer class="page-column pt-12 text-xs text-muted-foreground/70">
			Data from ESPN. Pylon isn't affiliated with or endorsed by the NFL or ESPN; team names, logos
			and data belong to their owners.
		</footer>
	</main>

	<nav
		aria-label="Main"
		data-sveltekit-preload-code="eager"
		class="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.5rem+env(safe-area-inset-bottom))] grid-cols-2 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur [view-transition-name:tabbar] md:hidden"
	>
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class={cn(
					'flex flex-col items-center justify-center gap-1 py-2.5 text-[0.7rem] text-muted-foreground transition-colors',
					active && 'text-foreground'
				)}
			>
				<span class="relative isolate grid h-7 w-14 place-items-center">
					{#if active}
						<span
							in:receiveBar={{ key: 'active' }}
							out:sendBar={{ key: 'active' }}
							class="absolute inset-0 -z-10 rounded-full bg-accent"
						></span>
					{/if}
					<tab.icon class={cn('size-5 transition-colors', active && 'text-pylon')} />
				</span>
				{tab.label}
			</a>
		{/each}
	</nav>
</div>
