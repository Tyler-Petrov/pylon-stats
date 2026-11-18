<script lang="ts">
	import { resolve } from '$app/paths';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import { cn } from '#lib/utils.js';
	import { indicator } from '#lib/motion.js';
	import type { GameDetail } from '#lib/types.js';

	let { game }: { game: GameDetail } = $props();

	// One team at a time: a box score has too many columns to put both side by side. The away team goes first,
	// as it does everywhere on the page.
	let picked = $state<string>();
	const shown = $derived(game.boxScore.find((side) => side.team.id === picked) ?? game.boxScore[0]);

	const [send, receive] = indicator();
</script>

<section aria-labelledby="box-score">
	<!-- The page's own tab says "Box score" (routes/games/[id]), so the heading is only for a screen reader. -->
	<h2 id="box-score" class="sr-only">Box score</h2>
	<div class="mb-4 flex">
		<div role="group" aria-label="Team" class="flex gap-1 rounded-full border border-border p-1">
			{#each game.boxScore as side (side.team.id)}
				{@const active = side === shown}
				<button
					type="button"
					aria-pressed={active}
					onclick={() => (picked = side.team.id)}
					class={cn(
						'relative isolate flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm transition-colors',
						active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
					)}
				>
					{#if active}
						<span
							in:receive={{ key: 'team' }}
							out:send={{ key: 'team' }}
							class="absolute inset-0 -z-10 rounded-full bg-accent"
						></span>
					{/if}
					<TeamLogo team={side.team} class="size-5" />
					{side.team.abbreviation}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid gap-6">
		{#each shown.tables.filter((t) => t.rows.length) as table (table.name)}
			<div class="overflow-x-auto">
				<table class="w-full text-sm whitespace-nowrap">
					<thead>
						<tr class="border-b border-border text-xs text-muted-foreground">
							<th
								scope="col"
								class="sticky left-0 bg-background py-2.5 pr-4 text-left font-display text-base font-bold text-foreground"
							>
								{table.name}
							</th>
							{#each table.labels as label, i (i)}
								<th scope="col" class="px-2.5 py-2.5 text-right font-medium last:pr-0">
									<abbr title={label.long} class="no-underline">{label.short}</abbr>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each table.rows as row (row.player.id)}
							<tr class="border-b border-border last:border-0">
								<th scope="row" class="sticky left-0 bg-background py-2 pr-4 text-left font-normal">
									<a
										href={resolve('/players/[id=id]', { id: row.player.id })}
										class="hover:underline"
									>
										{row.player.name}
									</a>
								</th>
								{#each row.values as value, i (i)}
									<td class="px-2.5 py-2 text-right stat last:pr-0">{value}</td>
								{/each}
							</tr>
						{/each}
						<!-- With one player, the team line usually says the same again. It doesn't for passing: the team's
						     yards are net of sacks. -->
						{#if table.totals && (table.rows.length > 1 || table.totals.join() !== table.rows[0].values.join())}
							<tr class="border-t border-border text-muted-foreground">
								<th scope="row" class="sticky left-0 bg-background py-2 pr-4 text-left font-normal">
									Team
								</th>
								{#each table.totals as value, i (i)}
									<td class="px-2.5 py-2 text-right stat last:pr-0">{value}</td>
								{/each}
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{/each}
	</div>
</section>
