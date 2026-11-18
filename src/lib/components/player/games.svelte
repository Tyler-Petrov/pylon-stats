<script lang="ts">
	import { getGameLog } from '#lib/nfl.remote.js';
	import StatTable from '#lib/components/stat-table.svelte';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { cn } from '#lib/utils.js';
	import type { GameLog } from '#lib/types.js';

	let {
		id,
		picked,
		year
	}: {
		id: string;
		/** The season the app is showing, left out for the current one. */
		picked?: number;
		/** The season the stats above are for. Left out for a player with no stats at all. */
		year?: number;
	} = $props();

	// Read as it stands rather than awaited: the games are extra to the page, which neither waits on them nor
	// falls over if they fail. The first question is the one the route's load already asked.
	const query = $derived.by(() => {
		const first = getGameLog({ id, season: picked });
		// With no season picked ESPN answers with the last one the player was on a team in, which can be later
		// than the last one he has numbers in.
		return !picked && year && first.current && first.current.season !== year
			? getGameLog({ id, season: year })
			: first;
	});

	// The games already showing stay up, dimmed, while another season's are on the way: the page keeps its
	// length, and whoever is reading down here isn't thrown back up it.
	let last: GameLog | undefined;
	const log = $derived.by(() => {
		last = query.current ?? last;
		return last;
	});
	const waiting = $derived(log !== query.current);
	// Asked for a season the player has no games in, ESPN answers with his latest. That isn't this season's games.
	const tables = $derived(log && (!year || waiting || log.season === year) ? log.tables : []);
</script>

{#if query.error && !query.loading}
	<section class="mb-8">
		<h2 class="mb-3 text-2xl">Games</h2>
		<p class="text-sm text-muted-foreground">
			Couldn't load the games.
			<button
				type="button"
				class="text-pylon underline-offset-4 hover:underline"
				onclick={() => query.refresh()}
			>
				Try again
			</button>
		</p>
	</section>
{:else if tables.length}
	<section class="mb-8">
		<h2 class="mb-3 text-2xl">Games</h2>
		<div class={cn('grid gap-6 transition-opacity', waiting && 'opacity-50')}>
			{#each tables as table (table.title)}
				<StatTable stats={table} titled />
			{/each}
		</div>
	</section>
{:else if !query.current}
	<section class="mb-8">
		<h2 class="mb-3 text-2xl">Games</h2>
		<div class="flex justify-center py-16">
			<Spinner class="size-6 text-muted-foreground" />
		</div>
	</section>
{/if}
