<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import AppShell from '#lib/components/app-shell.svelte';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Pages `await` their queries. The first load shows `pending`; after that, a navigation keeps the
     current page up until the next one's awaits are ready, so pages never flash half-loaded. Inside
     the shell, so the nav stays put meanwhile. -->
<AppShell>
	<svelte:boundary onerror={console.error}>
		{@render children()}
		{#snippet pending()}
			<div class="flex min-h-[60dvh] items-center justify-center">
				<Spinner class="size-6 text-muted-foreground" />
			</div>
		{/snippet}
		{#snippet failed(error, reset)}
			<div class="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
				<p class="text-muted-foreground">
					Couldn't load this{error instanceof Error ? `: ${error.message}` : ''}
				</p>
				<button type="button" class="text-pylon underline-offset-4 hover:underline" onclick={reset}>
					Try again
				</button>
			</div>
		{/snippet}
	</svelte:boundary>
</AppShell>
