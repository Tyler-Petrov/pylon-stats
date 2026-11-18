<script lang="ts">
	import { slide } from 'svelte/transition';
	import { duration } from '#lib/motion.js';
	import RollingNumber from '#lib/components/rolling-number.svelte';
	import type { StatGroup } from '#lib/types.js';

	let { groups }: { groups: StatGroup[] } = $props();
</script>

<!--
	Every number the player has for a season or a career, a kind of stat at a time. Given another season, the
	list stays where it is and each number rolls to its new value; a kind of stat the player has nothing in that
	season folds away, taking only its own height with it.
-->
<!-- Each group is ruled off from the one above by a faint line; there's no box around them. -->
<div class="overflow-hidden">
	<div>
		{#each groups as group (group.title)}
			<section
				transition:slide={{ duration: duration() }}
				class="border-t border-border py-3.5 md:grid md:grid-cols-[7rem_1fr] md:gap-x-4"
			>
				<h3 class="mb-2.5 font-display text-base font-bold md:mb-0">
					{group.title}
				</h3>
				<dl class="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-x-3 gap-y-3">
					{#each group.columns as column, i (i)}
						<div>
							<dt title={column.long} class="text-xs text-muted-foreground">{column.short}</dt>
							<dd class="stat text-lg/6"><RollingNumber value={group.values[i] ?? '-'} /></dd>
						</div>
					{/each}
				</dl>
			</section>
		{/each}
	</div>
</div>
