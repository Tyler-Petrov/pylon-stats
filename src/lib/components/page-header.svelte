<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions
	}: {
		title: string;
		description?: string;
		/** Shown on the right, next to the title. */
		actions?: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} · Pylon</title>
</svelte:head>

<header class="page-column flex flex-wrap items-end justify-between gap-3 pt-6 pb-4 md:pt-10">
	<div class="min-w-0">
		<h1 class="truncate text-4xl md:text-5xl">{title}</h1>
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{@render actions?.()}
</header>
