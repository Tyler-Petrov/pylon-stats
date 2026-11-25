<script lang="ts">
	import { navigating, page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { getGame, getPlays } from '#lib/nfl.remote.js';
	import { gameDay, kickoff, period } from '#lib/format.js';
	import { gameTabOf, gameTabs, type GameTab } from '#lib/query.js';
	import { cn } from '#lib/utils.js';
	import { duration, indicator } from '#lib/motion.js';
	import { fly, slide } from 'svelte/transition';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import BackButton from '#lib/components/back-button.svelte';
	import BoxScore from '#lib/components/game/box-score.svelte';
	import Plays from '#lib/components/game/plays.svelte';
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

	// Each part of the game has a tab of its own (lib/query.ts), and the tab is in the address, so it can be
	// linked to. Switching tabs replaces the history entry, so going back leaves the game, not the last tab.
	const tabs = $derived(gameTabs(game));
	const tab = $derived(gameTabOf(game, page.url));
	// The tab being gone to lights up on the click, not once it has loaded.
	const picked = $derived(
		navigating.to?.route.id === page.route.id ? gameTabOf(game, navigating.to.url) : tab
	);
	/**
	 * This game on another tab. Only the box score goes without `?tab=`: a game on before ESPN has any player
	 * stats opens on its plays, and a bare address would move the reader to the box score once they arrive.
	 */
	function href(key: GameTab): ResolvedPathname {
		const path = resolve('/games/[id=id]', { id: game.id });
		// `resolve` takes no query for a route with params, so the tab goes on after it.
		return key === 'box' ? path : (`${path}?tab=${key}` as ResolvedPathname);
	}
	const [send, receive] = indicator();

	// The play going on right now, with the team that has the ball.
	const now = $derived(
		live && (game.situation?.downDistance || game.situation?.lastPlay) ? game.situation : null
	);
	const offense = $derived(
		[game.away.team, game.home.team].find((team) => team.id === now?.possession) ?? null
	);

	// Every period that's been played, at least the four quarters.
	const periods = $derived(Math.max(4, game.away.linescores.length, game.home.linescores.length));
	const started = $derived(game.state !== 'pre' && game.away.linescores.length > 0);
	// The score at the end of each quarter folds out of the score itself, for whoever asks.
	let byQuarter = $state(false);
	const running = (points: number[]) => {
		let total = 0;
		return Array.from({ length: periods }, (_, i) =>
			i < points.length ? (total += points[i]) : null
		);
	};
	const quarters = $derived.by(() => {
		const away = running(game.away.linescores);
		const home = running(game.home.linescores);
		return away.map((score, i) => ({ away: score, home: home[i] }));
	});

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
				class="block truncate font-display text-xl leading-none font-bold group-hover:underline md:text-3xl"
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

{#snippet middle()}
	{#if game.state === 'pre'}
		<span class="stat text-2xl font-semibold md:text-4xl">{kickoff(game.date)}</span>
	{:else}
		<span
			class="flex items-center gap-2 text-5xl font-semibold md:gap-4 md:text-7xl"
			aria-label="{game.away.team.name} {game.away.score}, {game.home.team.name} {game.home.score}"
		>
			{@render score(game.away)}
			<span class="text-2xl text-muted-foreground md:text-4xl">–</span>
			{@render score(game.home)}
		</span>
	{/if}
	{#if game.state !== 'pre'}
		<span
			class={cn(
				'flex items-center gap-1.5 text-xs font-semibold',
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
			{#if started}
				<span class="sr-only">, score by quarter</span>
				<ChevronDown class={cn('size-3.5 transition-transform', byQuarter && 'rotate-180')} />
			{/if}
		</span>
	{/if}
{/snippet}

<div>
	<!-- Each team's colour washes in from its own side. -->
	<header
		class="border-b border-border"
		style:background="linear-gradient(100deg, color-mix(in oklab, {game.away.team.color} 28%, transparent),
		transparent 45%, transparent 55%, color-mix(in oklab, {game.home.team.color} 28%, transparent))"
	>
		<div class="page-column pt-3 pb-6 md:pt-6">
			<BackButton fallback={resolve('/')} />
			<p class="mt-1 mb-4 text-center text-sm text-muted-foreground">
				{#if game.week}Week {game.week} ·{/if}
				{gameDay(game.date)}
			</p>
			<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-8">
				{@render side(game.away)}
				{#if started}
					<!-- The score is the way into its own breakdown. -->
					<button
						type="button"
						aria-expanded={byQuarter}
						aria-controls="by-quarter"
						onclick={() => (byQuarter = !byQuarter)}
						class="-my-2 flex flex-col items-center gap-2 rounded-2xl px-3 py-2 transition-colors hover:bg-foreground/5"
					>
						{@render middle()}
					</button>
				{:else}
					<div class="flex flex-col items-center gap-2">{@render middle()}</div>
				{/if}
				{@render side(game.home)}
			</div>
			{#if started && byQuarter}
				<!-- The score as each quarter ended, each the same way round as the big one above it: away on the
				     left, home on the right, the side in front picked out. Padding, not a margin, keeps the fold
				     from jumping as it opens. -->
				<div id="by-quarter" transition:slide={{ duration: duration(200) }} class="pt-4">
					<dl class="mx-auto flex w-fit gap-x-5 md:gap-x-7">
						{#each quarters as { away, home }, i (i)}
							<div class="text-center">
								<dt class="text-[0.7rem] text-muted-foreground">
									<span class="sr-only">After</span>
									{i < 4 ? 'Q' : ''}{period(i + 1)}
								</dt>
								<dd class="stat text-sm text-muted-foreground">
									<!-- A quarter still to come has no score, which isn't one of nothing. -->
									<span class="sr-only">
										{game.away.team.abbreviation}
										{away ?? 'not yet'}, {game.home.team.abbreviation}
										{home ?? 'not yet'}
									</span>
									<span aria-hidden="true">
										{#if away == null || home == null}
											–
										{:else}
											<span class={away > home ? 'text-foreground' : ''}>{away}</span>–<span
												class={home > away ? 'text-foreground' : ''}>{home}</span
											>
										{/if}
									</span>
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/if}
			{#if facts.length}
				<p class="mt-5 text-center text-xs text-muted-foreground">{facts.join(' · ')}</p>
			{/if}
		</div>
	</header>

	<div class="page-column pt-6">
		{#if now}
			<!-- The play as it happens, above whichever tab is open. It moves on with the score, every 30 seconds. -->
			<section
				aria-labelledby="now"
				class={cn(
					'mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3',
					now.redZone && 'border-flag/40 bg-flag/10'
				)}
			>
				{#if offense}
					<TeamLogo team={offense} class="mt-0.5 size-8" />
				{/if}
				<div class="min-w-0 flex-1 text-sm">
					<h2
						id="now"
						class="flex flex-wrap items-center gap-x-2 font-sans text-sm font-semibold tracking-normal"
					>
						<span class="flex items-center gap-1.5 text-xs text-pylon">
							<span class="size-1.5 rounded-full bg-pylon"></span>
							Live
						</span>
						{#if offense}
							<span class="sr-only">Possession: {offense.name}.</span>
						{/if}
						{#if now.downDistance}
							<span class={cn(now.redZone && 'text-flag')}>{now.downDistance}</span>
						{/if}
						{#if now.redZone}
							<span class="text-xs font-medium text-flag">Red zone</span>
						{/if}
					</h2>
					{#if now.lastPlay}
						<!-- Read out as it changes: that's the news. -->
						<p aria-live="polite" class="mt-1 text-muted-foreground">
							{#key now.lastPlay}
								<span class="inline-block" in:fly={{ y: -6, duration: duration(220) }}>
									<span class="sr-only">Last play:</span>
									{now.lastPlay}
								</span>
							{/key}
						</p>
					{/if}
				</div>
			</section>
		{/if}

		{#if tabs.length}
			<!-- Switching tabs keeps the scroll where it is, and the underline slides across to the tab picked. On a
			     phone the strip scrolls sideways should it not fit. -->
			<nav
				aria-label="Game"
				class="-mx-4 mb-5 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
			>
				<div class="flex w-max min-w-full gap-1 border-b border-border">
					{#each tabs as { key, label, short } (key)}
						{@const active = picked === key}
						<a
							href={href(key)}
							aria-current={active ? 'page' : undefined}
							data-sveltekit-reset="false"
							data-sveltekit-replacestate
							class={cn(
								'relative px-3 pb-2 text-sm whitespace-nowrap transition-colors sm:text-base',
								active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
							)}
						>
							<span class="sm:hidden">{short}</span>
							<span class="hidden sm:inline">{label}</span>
							{#if active}
								<span
									in:receive={{ key: 'tab' }}
									out:send={{ key: 'tab' }}
									class="absolute inset-x-0 -bottom-px h-0.5 bg-pylon"
								></span>
							{/if}
						</a>
					{/each}
				</div>
			</nav>
		{/if}

		{#if tab === 'box'}
			<BoxScore {game} />
		{:else if tab === 'plays'}
			<!-- The plays come with the page (see its load), so this boundary only catches a failure and leaves the rest
			     of the page standing. Svelte 5.57 gets a pending snippet here wrong: while it's mounted, the tab
			     strip's links keep their old state, even as the underline moves to the new tab. -->
			<div class="max-w-3xl">
				<svelte:boundary>
					<Plays {game} />

					{#snippet failed(error, reset)}
						<div class="flex flex-col items-center gap-3 py-16 text-center">
							<p class="text-muted-foreground">
								Couldn't load the plays{error instanceof Error ? `: ${error.message}` : ''}
							</p>
							<!-- A query that failed stays failed until it's asked again. -->
							<button
								type="button"
								class="text-pylon underline-offset-4 hover:underline"
								onclick={() => {
									getPlays(params.id).refresh();
									reset();
								}}
							>
								Try again
							</button>
						</div>
					{/snippet}
				</svelte:boundary>
			</div>
		{:else if tab === 'stats'}
			<div class="max-w-3xl">
				<TeamStats {game} />
			</div>
		{:else if tab === 'scoring'}
			<div class="max-w-3xl">
				<Scoring {game} />
			</div>
		{/if}

		{#if game.state === 'pre'}
			<p class="mt-8 text-center text-muted-foreground">
				The box score fills in once the game kicks off.
			</p>
		{/if}
	</div>
</div>
