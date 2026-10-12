<script lang="ts">
	import { resolve } from '$app/paths';
	import { getPlayer } from '#lib/nfl.remote.js';
	import { cn } from '#lib/utils.js';
	import type { StatTable } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();

	const player = $derived(await getPlayer(params.id));
</script>

<svelte:head>
	<title>{player.name} · Pylon</title>
</svelte:head>

{#snippet table(stats: StatTable, highlightFirst: boolean)}
	<section class="mb-8">
		<h2 class="mb-3 text-2xl">{stats.title}</h2>
		<div class="overflow-x-auto rounded-xl border border-border bg-card">
			<table class="w-full text-sm whitespace-nowrap">
				<thead>
					<tr class="border-b border-border text-xs text-muted-foreground">
						<th class="sticky left-0 bg-card px-4 py-2.5 text-left font-medium"></th>
						{#each stats.labels as label, i (i)}
							<th class="px-2.5 py-2.5 text-right font-medium">{label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each stats.rows as row, r (r)}
						<tr
							class={cn(
								'border-b border-border last:border-0',
								highlightFirst && r === 0 && 'text-team'
							)}
						>
							<td class="sticky left-0 bg-card px-4 py-2">{row.label}</td>
							{#each row.values as value, i (i)}
								<td class="px-2.5 py-2 text-right stat">{value}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/snippet}

<div style:--team={player.team?.color ?? 'var(--pylon)'}>
	<header
		class="border-b border-border"
		style="background: linear-gradient(120deg, color-mix(in oklab, var(--team) 25%, transparent),
		transparent 70%)"
	>
		<div class="page-column flex items-end gap-5 pt-6 md:pt-10">
			{#if player.headshot}
				<img src={player.headshot} alt="" class="h-32 w-auto object-contain md:h-44" />
			{/if}
			<div class="min-w-0 flex-1 pb-6">
				{#if player.team}
					<a
						href={resolve('/teams/[id=id]', { id: player.team.id })}
						class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<img src={player.team.logo} alt="" class="size-5" />
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
			{@render table(player.season, true)}
		{/if}
		{#if player.gameLog}
			{@render table(player.gameLog, false)}
		{/if}
		{#if !player.season && !player.gameLog}
			<p class="py-10 text-center text-muted-foreground">No stats yet this season.</p>
		{/if}
	</div>
</div>
