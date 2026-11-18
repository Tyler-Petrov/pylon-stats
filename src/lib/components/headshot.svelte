<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { fadeIn } from '#lib/motion.js';

	let { src, class: className }: { src: string | null; class?: string } = $props();

	// ESPN names a headshot for players it has no picture of, mostly from seasons long past.
	let missing = $state<string>();
</script>

<!-- A player's face in a circle. ESPN's headshots are wider than tall, so the sides are cropped away; a player
     without one keeps the empty circle, and the rows of a list still line up. -->
<div class={cn('relative size-10 shrink-0 overflow-hidden rounded-full bg-muted', className)}>
	{#if src && src !== missing}
		<img
			{src}
			alt=""
			loading="lazy"
			onerror={() => (missing = src ?? undefined)}
			{@attach fadeIn}
			class="absolute top-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover"
		/>
	{/if}
</div>
