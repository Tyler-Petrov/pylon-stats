<script lang="ts">
	import { Popover } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { season } from '#lib/season.svelte.js';
	import { cn } from '#lib/utils.js';

	let {
		side = 'bottom',
		align = 'start',
		class: className
	}: { side?: 'top' | 'bottom'; align?: 'start' | 'end'; class?: string } = $props();

	// Not awaited: the picker is part of the frame around every page, and shouldn't hold one up.
	const seasons = $derived(season.all);
	const shown = $derived(season.picked ?? seasons[0]);
	let open = $state(false);

	function pick(year: number) {
		// The current season is what everything shows by itself.
		season.picked = year === seasons[0] ? undefined : year;
		open = false;
		// A week of the regular season is the same week in any season. A playoff round isn't: ESPN numbers them
		// differently from one season to the next, so from one of those it's back to where the season opens.
		if (
			page.route.id === '/weeks/[seasonType=int]/[week=int]' &&
			Number(page.params.seasonType) === 3
		)
			goto(resolve('/'));
	}
</script>

<!-- The season everything is showing: plain words and a chevron, opening onto the years. -->
<!-- Opened with no years to show, it asks for them again: the first try may have failed. -->
<Popover.Root bind:open onOpenChange={(next) => next && !seasons.length && season.retry()}>
	<Popover.Trigger
		class={cn(
			'flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground data-[state=open]:text-foreground',
			className
		)}
	>
		<span><span class="stat text-foreground">{shown ?? ''}</span> season</span>
		<ChevronDown class={cn('size-3.5 transition-transform', open && 'rotate-180')} />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			{side}
			{align}
			sideOffset={8}
			collisionPadding={12}
			class="z-50 rounded-xl border border-border bg-popover p-2 shadow-xl shadow-black/40 outline-none"
		>
			<div
				role="group"
				aria-label="Season"
				class="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto overscroll-contain"
			>
				{#each seasons as year (year)}
					<button
						type="button"
						aria-pressed={year === shown}
						onclick={() => pick(year)}
						class={cn(
							'rounded-lg px-2.5 py-1.5 stat text-sm transition-colors',
							year === shown
								? 'bg-pylon text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-foreground'
						)}
					>
						{year}
					</button>
				{/each}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
