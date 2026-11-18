<script lang="ts">
	import { resolve } from '$app/paths';
	import { cn } from '#lib/utils.js';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import type { StatTable } from '#lib/types.js';

	let { stats: given }: { stats: StatTable } = $props();

	/** Nothing in it ("0", "0.0", "-"): it steps back, so the numbers with something in them show. */
	const blank = (value: string) => !/[1-9]/.test(value);

	// A kind of stat the player has nothing in all season (a receiver's carries) is left out, as it is from the
	// lists above, and the table keeps to what he did.
	const stats = $derived.by((): StatTable => {
		if (!given.groups?.length) return given;
		const kept: number[] = [];
		const groups = [];
		let start = 0;
		for (const group of given.groups) {
			const columns = Array.from({ length: group.span }, (_, i) => start + i);
			start += group.span;
			if (columns.every((c) => given.rows.every((row) => blank(row.values[c] ?? '')))) continue;
			kept.push(...columns);
			groups.push(group);
		}
		if (!groups.length) return given;
		return {
			...given,
			groups,
			labels: kept.map((c) => given.labels[c]),
			strong: given.strong && kept.map((c) => given.strong![c]),
			rows: given.rows.map((row) => ({ ...row, values: kept.map((c) => row.values[c]) }))
		};
	});

	// Over the columns, what each run of them is ("Passing", "Rushing"), each in its kind's hue.
	const groups = $derived(stats.groups ?? []);
	// Which run each column is in, and the columns a run starts at (ruled off from the run before).
	const runs = $derived(groups.flatMap((group, g) => Array.from({ length: group.span }, () => g)));
	const starts = $derived(new Set(runs.flatMap((g, i) => (i > 0 && runs[i - 1] !== g ? [i] : []))));
	const kind = (column: number) => {
		const k = groups[runs[column]]?.kind;
		return k ? `var(--kind-${k}, var(--muted-foreground))` : 'var(--muted-foreground)';
	};

	// The week is as wide as the longest one in the table: "Wk 10" in a season, "Conf. Champ." in the playoffs.
	const when = $derived(Math.max(0, ...stats.rows.map((row) => row.game?.when.length ?? 0)));

	function tone(value: string, column: number) {
		if (blank(value)) return 'text-muted-foreground/50';
		return stats.strong?.[column] ? 'font-medium text-tinted' : 'text-foreground/70';
	}
</script>

<!--
	A player's games in one season, a row a game, in the same terms as the lists above it: the kinds of stat in
	their hues, the headline columns bright, zeros faint.
-->
<div class="overflow-x-auto">
	<table class="w-max text-sm whitespace-nowrap">
		<thead>
			{#if groups.length}
				<tr class="text-xs">
					<td class="sticky left-0 bg-background"></td>
					{#each groups as group, g (g)}
						<th
							scope="colgroup"
							colspan={group.span}
							style:--kind={kind(groups.slice(0, g).reduce((n, x) => n + x.span, 0))}
							class={cn(
								'px-2.5 pt-1 pb-0.5 text-left font-display text-sm font-bold text-(--kind)',
								g > 0 && 'border-l border-border'
							)}
						>
							{group.label}
						</th>
					{/each}
				</tr>
			{/if}
			<tr class="border-b border-border text-xs text-muted-foreground">
				<th
					scope="col"
					class="sticky left-0 bg-background py-2 pr-4 text-left font-display text-base font-bold text-foreground"
				>
					{stats.title}
				</th>
				{#each stats.labels as label, i (i)}
					<th
						scope="col"
						style:--kind={kind(i)}
						class={cn(
							'px-2.5 py-2 text-right font-medium last:pr-0',
							starts.has(i) && 'border-l border-border',
							stats.strong?.[i] && 'text-(--kind)'
						)}
					>
						{label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each stats.rows as row, r (r)}
				<tr class={cn('border-b border-border last:border-0', row.total && 'border-t')}>
					<th
						scope="row"
						class={cn(
							'sticky left-0 bg-background py-2 pr-4 text-left font-normal',
							row.total && 'text-muted-foreground'
						)}
					>
						{#if row.game && row.gameId}
							<!-- When, who against, and how it went, as in a team's schedule. A phone puts how it went
								 under who against, to leave the numbers room. -->
							<a
								href={resolve('/games/[id=id]', { id: row.gameId })}
								aria-label={row.label}
								style:--when="{when}ch"
								class="group grid grid-cols-[calc(var(--when)+0.375rem)_auto] items-center md:grid-cols-[calc(var(--when)+0.5rem)_5.25rem_auto]"
							>
								<span class="text-muted-foreground">{row.game.when}</span>
								<span class="flex items-center gap-1.5">
									<span class="w-4 text-xs text-muted-foreground">{row.game.at}</span>
									{#if row.game.team.logo}
										<TeamLogo team={row.game.team} class="size-5" />
									{:else}
										<span class="size-5 shrink-0"></span>
									{/if}
									<span class="group-hover:underline">{row.game.team.abbreviation}</span>
								</span>
								<span class="col-start-2 stat text-xs md:col-start-auto md:text-sm">
									<span
										class={cn(
											'font-semibold',
											row.game.result === 'W'
												? 'text-turf'
												: row.game.result === 'L'
													? 'text-flag'
													: 'text-muted-foreground'
										)}>{row.game.result}</span
									>
									<span class="text-muted-foreground">{row.game.score}</span>
								</span>
							</a>
						{:else}
							{row.label}
						{/if}
					</th>
					{#each row.values as value, i (i)}
						<td
							style:--kind={kind(i)}
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
