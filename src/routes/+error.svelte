<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	// A 502 is ESPN failing us, which usually passes in a moment, so offer a retry rather than a dead end.
	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Error'} · Pylon</title>
</svelte:head>

<div class="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
	<h1 class="text-4xl">{missing ? 'Not found' : 'No data right now'}</h1>
	<p class="max-w-sm text-muted-foreground">
		{#if missing}
			There's nothing at this address.
		{:else if page.status === 502}
			ESPN didn't answer this time. It usually comes back within a few seconds.
		{:else}
			Something went wrong{page.error?.message ? `: ${page.error.message}` : ''}.
		{/if}
	</p>
	<div class="flex gap-6">
		{#if !missing}
			<button
				type="button"
				class="text-pylon underline-offset-4 hover:underline"
				onclick={() => location.reload()}
			>
				Try again
			</button>
		{/if}
		<a href={resolve('/')} class="text-muted-foreground underline-offset-4 hover:underline">
			Go to scores
		</a>
	</div>
</div>
