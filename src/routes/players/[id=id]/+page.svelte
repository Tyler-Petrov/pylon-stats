<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getCareer, getGameLog, getPlayer } from '#lib/nfl.remote.js';
	import { seasonOf } from '#lib/query.js';
	import { fadeIn } from '#lib/motion.js';
	import StatTable from '#lib/components/stat-table.svelte';
	import type { StatTable as Stats } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const player = $derived(await getPlayer(params.id));

	// The season whose games are shown is in the address (`?season=2023`), so a link or the back button keeps
	// it. Both of these are extra to the page: should one fail, the page carries on without it.
	const [career, log] = $derived(
		await Promise.all([
			getCareer(params.id).catch((): Stats[] => []),
			getGameLog({ id: params.id, season: seasonOf(page.url) }).catch(() => null)
		])
	);

	function pick(season: string) {
		// The latest season is what the page shows by itself, so it stays out of the address.
		const here =
			Number(season) === log?.seasons[0]
				? resolve('/players/[id=id]', { id: params.id })
				: resolve(`/players/[id=id]?season=${Number(season)}`, { id: params.id });
		goto(here, { reset: false });
	}
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

		{#if player.season}
			<section class="mb-8">
				<h2 class="mb-3 text-2xl">{player.season.title}</h2>
				<StatTable stats={player.season} highlightFirst />
			</section>
		{/if}

		<!-- Any player with a season gets the picker, even over a season without stats: an earlier one may
		     have them. -->
		{#if log?.seasons.length}
			<section class="mb-8">
				<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
					<h2 class="text-2xl">Game log</h2>
					<label class="flex items-center gap-2 text-sm text-muted-foreground">
						Season
						<select
							value={String(log.season)}
							onchange={(event) => pick(event.currentTarget.value)}
							class="rounded-full border border-border bg-card py-1 pr-2 pl-3 stat text-foreground"
						>
							{#each log.seasons as season (season)}
								<option value={String(season)}>{season}</option>
							{/each}
						</select>
					</label>
				</div>
				<div class="grid gap-6">
					{#each log.tables as table (table.title)}
						<StatTable stats={table} titled />
					{:else}
						<p class="py-6 text-center text-muted-foreground">No stats in {log.season}.</p>
					{/each}
				</div>
			</section>
		{:else if !log}
			<p class="mb-8 text-sm text-muted-foreground">Couldn't load the game log.</p>
		{/if}

		{#if career.length}
			<section class="mb-8">
				<h2 class="mb-3 text-2xl">Career</h2>
				<div class="grid gap-6">
					{#each career as table (table.title)}
						<StatTable stats={table} titled />
					{/each}
				</div>
			</section>
		{/if}

		{#if !player.season && !career.length && log && !log.seasons.length}
			<p class="py-10 text-center text-muted-foreground">No stats yet.</p>
		{/if}
	</div>
</div>
