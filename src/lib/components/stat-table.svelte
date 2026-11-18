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
					<th scope="col" class="px-2.5 py-2.5 text-right font-medium last:pr-0">{label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each stats.rows as row, r (r)}
				<tr
					class={cn(
						'border-b border-border last:border-0',
						highlightFirst && r === 0 && 'text-team',
						row.total && 'text-muted-foreground'
					)}
				>
					<th scope="row" class="sticky left-0 bg-background py-2 pr-4 text-left font-normal">
						{#if row.gameId}
							<a href={resolve('/games/[id=id]', { id: row.gameId })} class="hover:underline">
								{row.label}
							</a>
						{:else}
							{row.label}
						{/if}
					</th>
					{#each row.values as value, i (i)}
						<td class="px-2.5 py-2 text-right stat last:pr-0">{value}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
