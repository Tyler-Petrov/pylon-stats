<script lang="ts">
	import { resolve } from '$app/paths';
	import { getGame } from '#lib/nfl.remote.js';
	import { gameDay, kickoff, period } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { duration } from '#lib/motion.js';
	import { fly } from 'svelte/transition';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import BoxScore from '#lib/components/game/box-score.svelte';
	import Scoring from '#lib/components/game/scoring.svelte';
	import TeamStats from '#lib/components/game/team-stats.svelte';
	import type { GameSide } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const query = $derived(getGame(params.id));
	const game = $derived(await query);

	const live = $derived(game.state === 'in');
	const final = $derived(game.state === 'post');
	const kickoffAt = $derived(new Date(game.date).getTime());

	// From kickoff to the final whistle, keep it moving: a page opened before the game turns into the box score
	// by itself. The server caches ESPN for 20 seconds. Only primitives are read here, so a refresh that changes
	// nothing else doesn't restart the timers.
	$effect(() => {
		if (final) return;
		const current = query;
		let timer: ReturnType<typeof setTimeout>;
		// Every 30 seconds once it's on. Before then, at kickoff, checking in hourly on the way (a timer days
		// long would fire at once). Without a kickoff time, it polls as if the game were on.
		const next = () =>
			kickoffAt > Date.now() ? Math.min(kickoffAt - Date.now(), 60 * 60 * 1000) : 30_000;
		const tick = () => {
			current.refresh();
			timer = setTimeout(tick, next());
		};
		timer = setTimeout(tick, next());
		return () => clearTimeout(timer);
	});

	// Every period that's been played, at least the four quarters.
	const periods = $derived(Math.max(4, game.away.linescores.length, game.home.linescores.length));
	const started = $derived(game.state !== 'pre' && game.away.linescores.length > 0);

	const facts = $derived(
		[
			game.venue,
			game.broadcast,
			game.attendance ? `${game.attendance.toLocaleString()} attendance` : null,
			game.state === 'pre' ? game.odds : null
		].filter(Boolean)
	);
</script>

<svelte:head>
	<title>{game.away.team.abbreviation} at {game.home.team.abbreviation} · Pylon</title>
</svelte:head>

{#snippet side(s: GameSide)}
	{@const lost = final && s.winner === false}
	<a
		href={resolve('/teams/[id=id]', { id: s.team.id })}
		class="group flex min-w-0 flex-col items-center gap-2 text-center"
	>
		<TeamLogo team={s.team} class="size-16 md:size-24" />
		<span class={cn('min-w-0', lost && 'text-muted-foreground')}>
			<span class="hidden text-sm text-muted-foreground sm:block">{s.team.location}</span>
			<span
				class="block truncate font-display text-xl leading-none font-bold tracking-wide uppercase group-hover:underline md:text-3xl"
			>
				{s.team.nickname}
			</span>
			{#if s.record}
				<span class="mt-1 block stat text-xs text-muted-foreground">{s.record}</span>
			{/if}
		</span>
	</a>
{/snippet}

{#snippet score(s: GameSide)}
	{@const lost = final && s.winner === false}
	<span class={cn('w-[2ch] stat', lost && 'text-muted-foreground')}>
		{#key s.score}
			<span class="inline-block" in:fly={{ y: -10, duration: duration(220) }}>{s.score ?? 0}</span>
		{/key}
	</span>
{/snippet}

<div>
	<!-- Each team's colour washes in from its own side. -->
	<header
		class="border-b border-border"
		style:background="linear-gradient(100deg, color-mix(in oklab, {game.away.team.color} 28%, transparent),
		transparent 45%, transparent 55%, color-mix(in oklab, {game.home.team.color} 28%, transparent))"
	>
		<div class="page-column pt-6 pb-6 md:pt-10">
			<p class="mb-4 text-center text-sm text-muted-foreground">
				{#if game.week}Week {game.week} ·{/if}
				{gameDay(game.date)}
			</p>
			<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-8">
				{@render side(game.away)}
				<div class="flex flex-col items-center gap-2">
					{#if game.state === 'pre'}
						<span class="stat text-2xl font-semibold md:text-4xl">{kickoff(game.date)}</span>
					{:else}
						<span
							class="flex items-center gap-2 text-5xl font-semibold md:gap-4 md:text-7xl"
							aria-label="{game.away.team.name} {game.away.score}, {game.home.team.name} {game.home
								.score}"
						>
							{@render score(game.away)}
							<span class="text-2xl text-muted-foreground md:text-4xl">–</span>
							{@render score(game.home)}
						</span>
					{/if}
					{#if game.state !== 'pre'}
						<span
							class={cn(
								'flex items-center gap-1.5 text-xs font-semibold uppercase',
								live ? 'text-pylon' : 'text-muted-foreground'
							)}
						>
							{#if live}
								<span class="relative flex size-2">
									<span
										class="absolute inline-flex size-full rounded-full bg-pylon opacity-75 motion-safe:animate-ping"
									></span>
									<span class="relative inline-flex size-2 rounded-full bg-pylon"></span>
								</span>
							{/if}
							{game.detail}
						</span>
					{/if}
				</div>
				{@render side(game.home)}
			</div>
			{#if live && game.situation?.downDistance}
				<p
					class={cn(
						'mx-auto mt-5 max-w-xl rounded-md bg-muted px-3 py-2 text-center text-sm',
						game.situation.redZone && 'bg-flag/15 text-flag'
					)}
				>
					{game.situation.downDistance}
					{#if game.situation.lastPlay}
						<span class="mt-0.5 block text-muted-foreground">{game.situation.lastPlay}</span>
					{/if}
				</p>
			{/if}
			{#if facts.length}
				<p class="mt-5 text-center text-xs text-muted-foreground">{facts.join(' · ')}</p>
			{/if}
		</div>
	</header>

	<div class="page-column grid gap-8 pt-6">
		{#if started}
			<!-- Points by quarter. -->
			<div class="overflow-x-auto rounded-xl border border-border bg-card">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border text-xs text-muted-foreground">
							<th scope="col" class="px-4 py-2 text-left font-medium"
								><span class="sr-only">Team</span></th
							>
							{#each { length: periods }, i (i)}
								<th scope="col" class="w-12 px-2 py-2 text-right font-medium">{period(i + 1)}</th>
							{/each}
							<th scope="col" class="w-14 py-2 pr-4 pl-2 text-right font-medium">T</th>
						</tr>
					</thead>
					<tbody>
						{#each [game.away, game.home] as s (s.team.id)}
							<tr class="border-b border-border last:border-0">
								<th scope="row" class="px-4 py-2 text-left font-normal">
									<span class="flex items-center gap-2">
										<TeamLogo team={s.team} class="size-6" />
										{s.team.abbreviation}
									</span>
								</th>
								{#each { length: periods }, i (i)}
									<td class="px-2 py-2 text-right stat text-muted-foreground">
										{s.linescores[i] ?? '–'}
									</td>
								{/each}
								<td
									class={cn(
										'py-2 pr-4 pl-2 text-right stat font-semibold',
										final && s.winner === false && 'text-muted-foreground'
									)}
								>
									{s.score ?? 0}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if game.boxScore.length}
			<!-- On a wide screen the box score takes the room, with the team numbers and the scoring beside it. On a
			     narrower one, those come first: they're the short version. -->
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
				<aside class="grid gap-8 lg:order-last">
					<TeamStats {game} />
					<Scoring {game} />
				</aside>
				<div class="min-w-0">
					<BoxScore {game} />
				</div>
			</div>
		{:else}
			<div class="mx-auto grid w-full max-w-xl gap-8">
				{#if game.teamStats.rows.length}
					<TeamStats {game} />
				{/if}
				<p class="text-center text-muted-foreground">
					{game.state === 'pre'
						? 'The box score fills in once the game kicks off.'
						: 'No box score for this game yet.'}
				</p>
			</div>
		{/if}
	</div>
</div>
