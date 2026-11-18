<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import { searchOf } from '#lib/query.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import Results from '#lib/components/search-results.svelte';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	// What's searched for is in the address (`?q=mahomes`), so coming back from a result finds the list
	// still there. The box itself is ahead of it by a pause in the typing.
	let text = $state(page.url.searchParams.get('q') ?? '');
	const query = $derived(searchOf(page.url));

	let timer: ReturnType<typeof setTimeout>;
	function search(wait: number) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const q = text.trim();
			const here = q ? resolve(`/search?q=${encodeURIComponent(q)}`) : resolve('/search');
			goto(here, { replace: true, reset: false });
		}, wait);
	}
	$effect(() => () => clearTimeout(timer));
</script>

<PageHeader title="Search" />

<div class="page-column">
	<form
		role="search"
		class="relative mb-6"
		onsubmit={(event) => {
			event.preventDefault();
			search(0);
		}}
	>
		<Search
			class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<!-- Arriving here is asking to type, so the box takes the keyboard. -->
		<input
			type="search"
			aria-label="Search teams and players"
			placeholder="A team or an active player"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			maxlength="40"
			bind:value={text}
			oninput={() => search(250)}
			{@attach (input) => input.focus()}
			class="w-full rounded-full border border-input bg-card py-3 pr-5 pl-11 text-base outline-none placeholder:text-muted-foreground focus-visible:border-pylon"
		/>
	</form>

	{#if query}
		<svelte:boundary>
			<Results {query} />
			{#snippet pending()}
				<div class="flex justify-center py-16">
					<Spinner class="size-6 text-muted-foreground" />
				</div>
			{/snippet}
			{#snippet failed(error, reset)}
				<div class="flex flex-col items-center gap-3 py-16 text-center">
					<p class="text-muted-foreground">
						Couldn't search just now{error instanceof Error ? `: ${error.message}` : ''}
					</p>
					<button
						type="button"
						class="text-pylon underline-offset-4 hover:underline"
						onclick={reset}
					>
						Try again
					</button>
				</div>
			{/snippet}
		</svelte:boundary>
	{:else}
		<p class="py-16 text-center text-muted-foreground">
			Type two letters or more of a team or a player's name.
		</p>
	{/if}
</div>
