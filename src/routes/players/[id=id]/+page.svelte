<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCareer, getPlayer } from '#lib/nfl.remote.js';
	import { fadeIn } from '#lib/motion.js';
	import { season } from '#lib/season.svelte.js';
	import SeasonPicker from '#lib/components/season-picker.svelte';
	import Games from '#lib/components/player/games.svelte';
	import StatList from '#lib/components/player/stat-list.svelte';
	import RollingNumber from '#lib/components/rolling-number.svelte';
	import type { StatGroup } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const player = $derived(await getPlayer(params.id));
	// Extra to the page: should it fail, the page carries on without it.
	const career = $derived(await getCareer(params.id).catch(() => null));

	// The season comes from the picker in the sidebar, as it does for the whole app. Left at the current one, a
	// player with nothing in it yet (or retired) shows the last season he has numbers in.
	const seasons = $derived(career?.seasons ?? []);
	const shown = $derived(
		season.picked ? seasons.find((s) => s.year === season.picked) : seasons.at(0)
	);
	const year = $derived(shown?.year ?? (seasons.length ? season.picked : undefined));

	const groups = $derived(
		(career?.categories ?? []).flatMap((c): StatGroup[] => {
			const values = c.seasons.find((s) => s.year === shown?.year)?.values;
			return values ? [{ title: c.title, columns: c.columns, values }] : [];
		})
	);
	const totals = $derived(
		(career?.categories ?? []).flatMap((c): StatGroup[] =>
			c.totals ? [{ title: c.title, columns: c.columns, values: c.totals }] : []
		)
	);

	const games = (count: string) => (count === '1' ? ' game' : ' games');
</script>

<svelte:head>
	<title>{player.name} · Pylon</title>
</svelte:head>

<div style:--team={player.team?.color ?? 'var(--pylon)'}>
	<header
		class="border-b border-border"
		style="background: linear-gradient(120deg, color-mix(in oklab, var(--team) 25%, transparent),
		transparent 70%)"
	>
		<div class="page-column flex items-end gap-5 pt-6 md:pt-10">
			{#if player.headshot}
				<!-- ESPN's headshots are all 600×436. Holding that shape keeps the name from jumping across once it loads. -->
				<img
					src={player.headshot}
					alt=""
					{@attach fadeIn}
					class="aspect-[600/436] h-32 w-auto object-contain md:h-44"
				/>
			{/if}
			<div class="min-w-0 flex-1 pb-6">
				{#if player.team}
					<a
						href={resolve('/teams/[id=id]', { id: player.team.id })}
						class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<!-- `data-team-logo`: the team page's logo shrinks into this one (lib/view-transitions.ts). -->
						<img src={player.team.logo} alt="" data-team-logo={player.team.id} class="size-5" />
						{player.team.name}
					</a>
				{/if}
				<h1 class="mt-1 text-4xl leading-none md:text-6xl">{player.name}</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					{#if player.jersey}<span class="stat text-team">#{player.jersey}</span> ·{/if}
					{player.position}
					{#if player.status && player.status !== 'Active'}
						· <span class="text-flag">{player.status}</span>
					{/if}
				</p>
			</div>
		</div>
	</header>

	<div class="page-column pt-6">
		<dl class="mb-8 flex flex-wrap gap-x-8 gap-y-3">
			{#each player.facts as fact (fact.label)}
				<div>
					<dt class="text-xs text-muted-foreground">{fact.label}</dt>
					<dd>{fact.value}</dd>
				</div>
			{/each}
		</dl>

		{#if year}
			<section class="mb-8">
				<div class="mb-3 flex flex-wrap items-baseline gap-x-3">
					<h2 class="text-2xl">{year} season</h2>
					{#if shown}
						<p class="text-sm text-muted-foreground">
							{shown.teams.join(', ')}
							{#if shown.games}
								{#if shown.teams.length}·{/if}
								<RollingNumber value={shown.games} suffix={games(shown.games)} />
							{/if}
						</p>
					{/if}
					<!-- A phone has no sidebar, so the season is picked here. -->
					<SeasonPicker align="end" class="ml-auto self-center md:hidden" />
				</div>
				{#if shown}
					<StatList {groups} />
				{:else}
					<p class="text-muted-foreground">No stats in {year}.</p>
				{/if}
			</section>
		{/if}

		{#if totals.length}
			<section class="mb-8">
				<div class="mb-3 flex flex-wrap items-baseline gap-x-3">
					<h2 class="text-2xl">Career</h2>
					{#if career?.games}
						<p class="text-sm text-muted-foreground">{career.games}{games(career.games)}</p>
					{/if}
				</div>
				<StatList groups={totals} />
			</section>
		{/if}

		{#if !career}
			<p class="mb-8 text-sm text-muted-foreground">Couldn't load the stats.</p>
		{:else if !seasons.length && !totals.length}
			<p class="py-10 text-center text-muted-foreground">No stats yet.</p>
		{/if}

		<!-- A new player is a new set of games: nothing of the last one's is held over. -->
		{#key params.id}
			<Games id={params.id} picked={season.picked} {year} />
		{/key}
	</div>
</div>
