<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { beforeNavigate, onNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import AppShell from '#lib/components/app-shell.svelte';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { transition } from '#lib/view-transitions.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onNavigate(transition);

	/* A release replaces the code and remote functions an open page was loaded with. SvelteKit polls
	   for one (`version` in vite.config.ts), and the page moves onto it at its next navigation, or
	   straight away while nobody's looking at it. */
	beforeNavigate(({ willUnload, to, cancel }) => {
		if (updated.current && !willUnload && to) {
			cancel();
			location.href = to.url.href;
		}
	});
	$effect(() => {
		if (updated.current && document.hidden) location.reload();
	});
	// Mobile browsers freeze hidden tabs, so the poll may have missed a release while it was away.
	async function reloadIfOutdated() {
		if (document.hidden ? updated.current : await updated.check()) location.reload();
	}
</script>

<svelte:document onvisibilitychange={reloadIfOutdated} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Pages `await` their queries. The first load shows `pending`; after that, a navigation keeps the
     current page up until the next one's awaits are ready, so pages never flash half-loaded. Inside
     the shell, so the nav stays put meanwhile. The page fades in when it first arrives (the wrapper
     stays put after that), and the spinner only fades in if the wait is long enough to notice. -->
<AppShell>
	<svelte:boundary onerror={console.error}>
		<div class="motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in">
			{@render children()}
		</div>
		{#snippet pending()}
			<div
				class="flex min-h-[60dvh] items-center justify-center motion-safe:animate-in motion-safe:delay-300 motion-safe:fill-mode-backwards motion-safe:fade-in"
			>
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
