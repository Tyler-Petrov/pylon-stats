<script lang="ts">
	import { resolve } from '$app/paths';
	import { getScoreboard } from '#lib/nfl.remote.js';
	import { gameDay } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { indicator, move } from '#lib/motion.js';
	import { prefersReducedMotion } from 'svelte/motion';
	import GameCard from './game-card.svelte';
	import PageHeader from './page-header.svelte';
	import TeamLogo from './team-logo.svelte';

	// Leave both out for whatever week ESPN calls current.
	let { week, seasonType }: { week?: number; seasonType?: number } = $props();

	const scoreboard = $derived(getScoreboard({ week, seasonType }));
	const board = $derived(await scoreboard);

	const live = $derived(board.games.filter((g) => g.state === 'in').length);

	// While games are on, keep the scores moving. The server caches ESPN for 20 seconds.
	$effect(() => {
		if (!live) return;
		const query = scoreboard;
		const timer = setInterval(() => query.refresh(), 30_000);
		return () => clearInterval(timer);
	});

	// Live games first, then upcoming, then finals, each group by kickoff and split by day.
	const order = { in: 0, pre: 1, post: 2 } as const;
	const days = $derived.by(() => {
		const sorted = board.games.toSorted((a, b) => a.date.localeCompare(b.date));
		return [...Map.groupBy(sorted, (game) => gameDay(game.date))].map(([day, games]) => ({
			day,
			games: games.toSorted((a, b) => order[a.state] - order[b.state])
		}));
	});

	const current = $derived(
		board.weeks.find((w) => w.week === board.week && w.seasonType === board.seasonType)
	);

	// The selected week's pill slides along the strip to the next week picked.
	const [send, receive] = indicator();

	// Keep the week being shown in the middle of the strip: straight there on arrival, gliding when it changes.
	// Only then: a refresh of the same week leaves alone a strip you've scrolled.
	const shown = $derived(`${board.seasonType}-${board.week}`);
	let centred = '';
	function centre(strip: HTMLElement) {
		const week = shown;
		// Wait for the strip to be on the page and laid out.
		let frame = requestAnimationFrame(function measure() {
			if (!strip.isConnected) return (frame = requestAnimationFrame(measure));
			const pill = strip.querySelector(`[data-week="${week}"]`)?.getBoundingClientRect();
			if (!pill) return;
			const view = strip.getBoundingClientRect();
			strip.scrollTo({
				left: strip.scrollLeft + pill.left - view.left - (view.width - pill.width) / 2,
				behavior: centred && !prefersReducedMotion.current ? 'smooth' : 'instant'
			});
			centred = week;
		});
		return () => cancelAnimationFrame(frame);
	}
</script>

<PageHeader
	title={current?.label ?? `Week ${board.week}`}
	description={`${board.season} season${live ? ` · ${live} live now` : ''}`}
/>

<div class="page-column">
	<nav
		aria-label="Weeks"
		data-week-strip
		{@attach centre}
		class="-mx-4 mb-6 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
	>
		<div class="flex w-max gap-1.5 pb-1">
			{#each board.weeks as w (`${w.seasonType}-${w.week}`)}
				{@const active = w.week === board.week && w.seasonType === board.seasonType}
				<a
					href={resolve('/weeks/[seasonType=int]/[week=int]', {
						seasonType: w.seasonType,
						week: w.week
					})}
					aria-current={active ? 'page' : undefined}
					data-week="{w.seasonType}-{w.week}"
					class={cn(
						'relative isolate rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors',
						active
							? 'border-pylon text-primary-foreground'
							: 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
					)}
				>
					{#if active}
						<span
							in:receive={{ key: 'week' }}
							out:send={{ key: 'week' }}
							class="absolute -inset-px -z-10 rounded-full bg-pylon"
						></span>
					{/if}
					{w.seasonType === 3 ? w.label : w.label.replace('Week ', 'Wk ')}
				</a>
			{/each}
		</div>
	</nav>

	{#each days as { day, games } (day)}
		<section class="mb-8">
			<h2 class="mb-3 text-xl text-muted-foreground">{day}</h2>
			<!-- When a refresh moves a game (kickoff, or the final whistle), its card glides to its new place. -->
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each games as game (game.id)}
					<div animate:move class="grid">
						<GameCard {game} />
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<p class="py-16 text-center text-muted-foreground">No games this week.</p>
	{/each}

	{#if board.byes.length}
		<section class="mb-8">
			<h2 class="mb-3 text-xl text-muted-foreground">On bye</h2>
			<div class="flex flex-wrap gap-2">
				{#each board.byes as team (team.id)}
					<a
						href={resolve('/teams/[id=id]', { id: team.id })}
						class="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1.5 text-sm transition-colors hover:bg-accent"
					>
						<TeamLogo {team} class="size-6" />
						{team.abbreviation}
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
