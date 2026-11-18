<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Search from '@lucide/svelte/icons/search';
	import { searchOf } from '#lib/query.js';
	import { getSearchResults } from '#lib/nfl.remote.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import Results from '#lib/components/search-results.svelte';

	// What's searched for is in the address (`?q=mahomes`), so coming back from a result finds the list
	// still there. The box itself is ahead of it by a pause in the typing.
	let text = $state(page.url.searchParams.get('q') ?? '');
	const query = $derived(searchOf(page.url));

	// Back, forward and the Search tab change the address under a page that's already here, and the box goes
	// with it. Not after the page's own `goto` below: by then the typing may have moved on.
	afterNavigate(({ type }) => {
		if (type !== 'goto') text = page.url.searchParams.get('q') ?? '';
	});

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
		<!-- No `pending` here: the route's load has the results before the page shows them (+page.ts). -->
		<svelte:boundary>
			<Results {query} />
			{#snippet failed(error, reset)}
				<div class="flex flex-col items-center gap-3 py-16 text-center">
					<p class="text-muted-foreground">
						Couldn't search just now{error instanceof Error ? `: ${error.message}` : ''}
					</p>
					<!-- The route's load still holds the search that failed, so ask again before showing it again. -->
					<button
						type="button"
						class="text-pylon underline-offset-4 hover:underline"
						onclick={() => {
							getSearchResults(query).refresh();
							reset();
						}}
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
