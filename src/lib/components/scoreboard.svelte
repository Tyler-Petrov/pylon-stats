<script lang="ts">
	import { navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import { getScoreboard } from '#lib/nfl.remote.js';
	import { season } from '#lib/season.svelte.js';
	import { gameDay } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { indicator, move } from '#lib/motion.js';
	import GameCard from './game-card.svelte';
	import PageHeader from './page-header.svelte';
	import SeasonPicker from './season-picker.svelte';
	import TeamLogo from './team-logo.svelte';

	// Leave both out for whatever week ESPN calls current, or the first week of a past season.
	let { week, seasonType }: { week?: number; seasonType?: number } = $props();

	// The season is the one the whole app is showing (lib/season.svelte.ts).
	const scoreboard = $derived(getScoreboard({ week, seasonType, season: season.picked }));
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

	// The whole season on one ruler: the regular season by number, then the playoff rounds by name.
	const regular = $derived(board.weeks.filter((w) => w.seasonType === 2));
	const playoffs = $derived(board.weeks.filter((w) => w.seasonType === 3));
	const ROUNDS: Record<string, string> = {
		'Wild Card': 'WC',
		'Divisional Round': 'DIV',
		'Conference Championship': 'CONF',
		'Pro Bowl': 'PB',
		'Super Bowl': 'SB'
	};

	// The week being gone to lights up on the click, not once its games have loaded.
	const WEEK = '/weeks/[seasonType=int]/[week=int]';
	const going = $derived(
		navigating.to?.route.id === WEEK
			? `${navigating.to.params?.seasonType}-${navigating.to.params?.week}`
			: undefined
	);
	const shown = $derived(going ?? `${board.seasonType}-${board.week}`);
	const [send, receive] = indicator();

	// In the season being played, the week it is now is marked, and the weeks to come are fainter.
	const now = Date.now();
	const thisWeek = $derived(
		season.picked ? undefined : board.weeks.findLast((w) => new Date(w.start).getTime() <= now)
	);
</script>

{#snippet cell(w: (typeof board.weeks)[number], label: string)}
	{@const key = `${w.seasonType}-${w.week}`}
	{@const active = key === shown}
	{@const ahead = !season.picked && new Date(w.start).getTime() > now}
	<a
		href={resolve('/weeks/[seasonType=int]/[week=int]', { seasonType: w.seasonType, week: w.week })}
		aria-current={active ? 'page' : undefined}
		aria-label={w.label}
		title={w.label}
		class={cn(
			'relative isolate grid h-9 place-items-center rounded-lg stat text-sm transition-colors',
			active
				? 'text-primary-foreground'
				: ahead
					? 'text-muted-foreground/50 hover:bg-accent hover:text-foreground'
					: 'text-muted-foreground hover:bg-accent hover:text-foreground'
		)}
	>
		{#if active}
			<span
				in:receive={{ key: 'week' }}
				out:send={{ key: 'week' }}
				class="absolute inset-0 -z-10 rounded-lg bg-pylon"
			></span>
		{/if}
		{label}
		{#if !active && thisWeek === w}
			<span class="absolute bottom-1 size-1 rounded-full bg-pylon"></span>
		{/if}
	</a>
{/snippet}

<PageHeader
	title={current?.label ?? `Week ${board.week}`}
	description={`${board.season} season${live ? ` · ${live} live now` : ''}`}
>
	{#snippet actions()}
		<SeasonPicker align="end" class="md:hidden" />
	{/snippet}
</PageHeader>

<div class="page-column">
	<!-- Every week of the season at once, so any of them is one click away and none is scrolled out of sight.
	     On a phone the regular season takes two rows. -->
	<nav
		aria-label="Weeks"
		data-week-strip
		class="mb-8 flex flex-col gap-1 border-y border-border py-1.5 md:flex-row md:items-center"
	>
		<span class="hidden pr-2 text-xs text-muted-foreground md:block">Week</span>
		<div
			style:--weeks={regular.length}
			class="grid grid-cols-9 gap-1 md:flex-[3] md:grid-cols-[repeat(var(--weeks),minmax(0,1fr))]"
		>
			{#each regular as w (w.week)}
				{@render cell(w, String(w.week))}
			{/each}
		</div>
		{#if playoffs.length}
			<span class="hidden h-5 w-px bg-border md:block"></span>
			<div
				style:--weeks={playoffs.length}
				class="grid grid-cols-[repeat(var(--weeks),minmax(0,1fr))] gap-1 md:flex-1"
			>
				{#each playoffs as w (w.week)}
					{@render cell(w, ROUNDS[w.label] ?? w.label)}
				{/each}
			</div>
		{/if}
	</nav>

	{#each days as { day, games } (day)}
		<section class="mb-8">
			<h2 class="mb-3 text-xl text-muted-foreground">{day}</h2>
			<!-- When a refresh moves a game (kickoff, or the final whistle), its card glides to its new place. -->
			<div class="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
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
