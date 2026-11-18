<script lang="ts">
	import { slide } from 'svelte/transition';
	import { duration } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import RollingNumber from '#lib/components/rolling-number.svelte';
	import type { StatGroup } from '#lib/types.js';

	let { groups }: { groups: StatGroup[] } = $props();

	/** A stat with nothing in it ("0", "0.0", "0-0", "-") steps back, so the ones with something in them show. */
	const blank = (value?: string) => !value || !/[1-9]/.test(value);

	// Each group split in two: the few numbers that say the most, then the rest. Kept as column numbers, so a
	// number keeps its place (and rolls) from one season to the next. A kind of stat with nothing in its
	// headlines (a quarterback's defense: a fumble of his own he fell on) is all small.
	const split = $derived(
		groups.map((group) => {
			const columns = group.columns.map((column, i) => ({ ...column, i }));
			const headlines = columns.filter((c) => c.headline);
			const quiet = headlines.every((c) => blank(group.values[c.i]));
			return {
				group,
				headlines: quiet ? [] : headlines,
				rest: quiet ? columns : columns.filter((c) => !c.headline)
			};
		})
	);
</script>

<!--
	Every number the player has for a season or a career, a kind of stat at a time. Given another season, the
	list stays where it is and each number rolls to its new value; a kind of stat the player has nothing in that
	season folds away, taking only its own height with it.
-->
<!-- Each group is ruled off from the one above by a faint line; there's no box around them. -->
<div class="overflow-hidden">
	<div>
		{#each split as { group, headlines, rest } (group.key)}
			<!-- Each kind of stat has a quiet hue of its own, the same one its columns have in the game log. -->
			<section
				transition:slide={{ duration: duration() }}
				style:--kind="var(--kind-{group.key}, var(--muted-foreground))"
				class="border-t border-border py-4 md:grid md:grid-cols-[7rem_1fr] md:gap-x-4"
			>
				<h3 class="mb-3 font-display text-base font-bold text-(--kind) md:mb-0">{group.title}</h3>
				<div>
					<!-- The headline numbers, large, with their names in words under them. -->
					{#if headlines.length}
						<dl
							class="mb-3.5 grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-x-4 gap-y-3 md:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]"
						>
							{#each headlines as column (column.i)}
								<div class="flex flex-col-reverse">
									<dt title={column.long} class="mt-1 text-xs text-(--kind)/80">
										{column.headline}
									</dt>
									<dd
										class={cn(
											'stat text-2xl/none md:text-3xl/none',
											blank(group.values[column.i]) ? 'text-muted-foreground' : 'text-tinted'
										)}
									>
										<RollingNumber value={group.values[column.i] ?? '-'} />
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
					<!-- The rest, small, each after its short name. The full name is on hover. -->
					<dl
						class="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-x-4 gap-y-1.5 text-sm md:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]"
					>
						{#each rest as column (column.i)}
							<div class="flex items-baseline gap-1.5">
								<dt title={column.long} class="text-xs text-muted-foreground">{column.short}</dt>
								<dd
									class={cn(
										'stat',
										blank(group.values[column.i])
											? 'text-muted-foreground/60'
											: 'text-foreground/85'
									)}
								>
									<RollingNumber value={group.values[column.i] ?? '-'} />
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			</section>
		{/each}
	</div>
</div>
