<script lang="ts">
	import { getTeamStats } from '#lib/nfl.remote.js';

	let { teamId }: { teamId: string } = $props();

	const stats = $derived(await getTeamStats(teamId));

	// Three numbers get a tile. The other headline numbers and ESPN's own "General" category (fumbles,
	// games played) are rows under them; every other category gets its own section below.
	const featured = ['Points / game', 'Red zone TD %', 'Turnover diff'];
	const tiles = $derived(stats.highlights.filter((s) => featured.includes(s.label)));
	const espnGeneral = $derived(stats.categories.find((c) => c.name === 'General'));
	const general = $derived([
		...stats.highlights.filter((s) => !featured.includes(s.label)),
		...(espnGeneral?.stats ?? [])
	]);
	// Scoring reads best right after General; the rest keep ESPN's order.
	const rest = $derived(
		stats.categories
			.filter((c) => c !== espnGeneral)
			.toSorted((a, b) => Number(b.name === 'Scoring') - Number(a.name === 'Scoring'))
	);
</script>

{#snippet rows(list: { label: string; value: string }[])}
	<dl class="overflow-hidden rounded-xl border border-border bg-card text-sm">
		{#each list as stat (stat.label)}
			<!-- Two equal columns, the value left aligned in its own. On a phone there's no room for that, so the
			     value takes only the width it needs, at the right. -->
			<div
				class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border px-4 py-2 last:border-0 sm:grid-cols-2"
			>
				<dt class="text-muted-foreground">{stat.label}</dt>
				<dd class="text-right stat sm:text-left">{stat.value}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<div class="grid gap-10">
	<section>
		<h3 class="mb-3 text-2xl">General</h3>
		<div class="grid gap-2 sm:grid-cols-3">
			{#each tiles as stat (stat.label)}
				<div class="rounded-xl border border-border bg-card p-4">
					<p class="text-xs text-muted-foreground">{stat.label}</p>
					<p class="mt-1 stat text-3xl font-semibold">{stat.value}</p>
					{#if stat.rank}
						<p class="mt-0.5 text-xs text-team">{stat.rank} in NFL</p>
					{/if}
				</div>
			{/each}
		</div>
		<div class="mt-4">{@render rows(general)}</div>
	</section>

	{#each rest as category (category.name)}
		<section>
			<h3 class="mb-3 text-2xl">{category.name}</h3>
			{@render rows(category.stats)}
		</section>
	{/each}
</div>
