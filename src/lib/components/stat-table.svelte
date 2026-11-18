<script lang="ts">
	import { resolve } from '$app/paths';
	import { cn } from '#lib/utils.js';
	import type { StatTable } from '#lib/types.js';

	let {
		stats,
		titled = false,
		highlightFirst = false
	}: {
		stats: StatTable;
		/** Put the table's title in its corner, as a box score does. Leave it out when a heading above says it. */
		titled?: boolean;
		/** Pick out the first row in the team's colour. */
		highlightFirst?: boolean;
	} = $props();

	// Over the columns, what each run of them is ("Passing", "Rushing"). One run needs no telling apart.
	const groups = $derived(stats.groups && stats.groups.length > 1 ? stats.groups : []);
	// The columns a run starts at, ruled off from the run before all the way down.
	const starts = $derived(
		new Set(groups.slice(1).map((_, g) => groups.slice(0, g + 1).reduce((n, x) => n + x.span, 0)))
	);

	// A game log's rows line up their week, opponent and result. The week is as wide as the longest one in
	// the table: "Wk 10" in a season, "Conf. Champ." in the playoffs.
	const when = $derived(Math.max(0, ...stats.rows.map((row) => row.game?.when.length ?? 0)));

	/** Nothing in it ("0", "0.0", "-"): it steps back, so the numbers with something in them show. */
	const blank = (value: string) => !/[1-9]/.test(value);

	function tone(value: string, column: number) {
		if (blank(value)) return 'text-muted-foreground/60';
		if (!stats.strong) return '';
		return stats.strong[column] ? 'font-medium text-foreground' : 'text-foreground/70';
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm whitespace-nowrap">
		<thead>
			{#if groups.length}
				<tr class="text-xs text-muted-foreground">
					<td class="sticky left-0 bg-background"></td>
					{#each groups as group, i (i)}
						<th
							scope="colgroup"
							colspan={group.span}
							class="border-l border-border px-2.5 pt-2.5 text-left font-medium"
						>
							{group.label}
						</th>
					{/each}
				</tr>
			{/if}
			<tr class="border-b border-border text-xs text-muted-foreground">
				<th
					scope="col"
					class={cn(
						'sticky left-0 bg-background py-2.5 pr-4 text-left font-medium',
						titled && 'font-display text-base font-bold text-foreground'
					)}
				>
					{#if titled}{stats.title}{:else}<span class="sr-only">{stats.title}</span>{/if}
				</th>
				{#each stats.labels as label, i (i)}
					<th
						scope="col"
						class={cn(
							'px-2.5 py-2.5 text-right font-medium last:pr-0',
							starts.has(i) && 'border-l border-border',
							stats.strong?.[i] && 'text-foreground'
						)}
					>
						{label}
					</th>
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
					<th
						scope="row"
						class={cn(
							'sticky left-0 bg-background py-2 pr-4 text-left font-normal',
							row.total && 'text-muted-foreground'
						)}
					>
						{#if row.game && row.gameId}
							<!-- When, who against, and how it went. A phone puts how it went under who against, to
								 leave the numbers room. -->
							<a
								href={resolve('/games/[id=id]', { id: row.gameId })}
								aria-label={row.label}
								style:--when="{when}ch"
								class="group grid grid-cols-[calc(var(--when)+0.375rem)_auto] items-baseline md:grid-cols-[calc(var(--when)+0.5rem)_3.5rem_auto]"
							>
								<span class="text-muted-foreground">{row.game.when}</span>
								<span class="group-hover:underline">{row.game.opponent}</span>
								<span class="col-start-2 text-xs md:col-start-auto md:text-sm">
									<span
										class={row.game.result === 'W'
											? 'font-medium text-foreground'
											: 'text-muted-foreground'}>{row.game.result}</span
									>
									<span class="stat text-muted-foreground">{row.game.score}</span>
								</span>
							</a>
						{:else if row.gameId}
							<a href={resolve('/games/[id=id]', { id: row.gameId })} class="hover:underline">
								{row.label}
							</a>
						{:else}
							{row.label}
						{/if}
					</th>
					{#each row.values as value, i (i)}
						<td
							class={cn(
								'px-2.5 py-2 text-right stat last:pr-0',
								starts.has(i) && 'border-l border-border',
								tone(value, i)
							)}
						>
							{value}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
