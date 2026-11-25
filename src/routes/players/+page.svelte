<script lang="ts">
	import { navigating, page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { getLeaders } from '#lib/nfl.remote.js';
	import { leadersOf } from '#lib/query.js';
	import { cn } from '#lib/utils.js';
	import { indicator } from '#lib/motion.js';
	import Headshot from '#lib/components/headshot.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import SeasonPicker from '#lib/components/season-picker.svelte';
	import { season } from '#lib/season.svelte.js';
	import TeamLogo from '#lib/components/team-logo.svelte';

	// The category and the sorted column are in the address, so any table can be linked to. Picking one replaces
	// the history entry rather than adding to it, so going back leaves the page. The season is the one the whole app is showing (lib/season.svelte.ts).
	const leaders = $derived(await getLeaders({ ...leadersOf(page.url), season: season.picked }));

	/** This page showing something else. What the page shows by itself stays out of the address. */
	function href({ category, sort }: { category: string; sort?: string }) {
		const query = [
			category !== leaders.categories[0].key && `category=${category}`,
			sort && `sort=${sort}`
		]
			.filter(Boolean)
			.join('&');
		return query ? resolve(`/players?${query}`) : resolve('/players');
	}

	// The category being gone to lights up on the click, not once its table has loaded.
	const going = $derived(
		navigating.to?.route.id === '/players' ? leadersOf(navigating.to.url) : undefined
	);
	const shown = $derived(going ? (going.category ?? leaders.categories[0].key) : leaders.category);

	// The selected category's pill slides along the strip to the next one picked.
	const [send, receive] = indicator();
</script>

<PageHeader
	title="Players"
	description="League leaders · {leaders.season} regular season · top {leaders.rows.length}"
>
	{#snippet actions()}
		<SeasonPicker align="end" class="md:hidden" />
	{/snippet}
</PageHeader>

<div class="page-column">
	<nav
		aria-label="Categories"
		class="-mx-4 mb-6 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
	>
		<div class="flex w-max gap-1.5 pb-1">
			{#each leaders.categories as tab (tab.key)}
				{@const active = tab.key === shown}
				<a
					href={href({ category: tab.key })}
					aria-current={active ? 'page' : undefined}
					data-sveltekit-reset="false"
					data-sveltekit-replacestate
					class={cn(
						'relative isolate rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors',
						active
							? 'border-pylon text-primary-foreground'
							: 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
					)}
				>
					{#if active}
						<span
							in:receive={{ key: 'category' }}
							out:send={{ key: 'category' }}
							class="absolute -inset-px -z-10 rounded-full bg-pylon"
						></span>
					{/if}
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>

	{#if leaders.rows.length}
		<div class="overflow-x-auto">
			<table class="w-full text-sm whitespace-nowrap">
				<thead>
					<tr class="border-b border-border text-xs text-muted-foreground">
						<th
							scope="col"
							class="sticky left-0 z-10 bg-background py-2.5 pr-4 text-left font-medium"
						>
							Player
						</th>
						<!-- Each heading sorts the table by its column, most first. A sort is only fetched once it's
						     picked: a pointer crossing the row would otherwise ask ESPN for every column it passes. -->
						{#each leaders.columns as column (column.key)}
							{@const sorted = column.key === leaders.sort}
							<th
								scope="col"
								aria-sort={sorted ? 'descending' : undefined}
								class="py-2.5 text-right font-medium last:[&>*]:pr-0"
							>
								{#if column.sortable}
									<a
										href={href({
											category: leaders.category,
											sort: column.key
										})}
										title={column.long}
										data-sveltekit-preload-data="tap"
										data-sveltekit-reset="false"
										data-sveltekit-replacestate
										class={cn(
											'inline-flex items-center gap-0.5 px-2.5 transition-colors hover:text-foreground',
											sorted && 'text-pylon hover:text-pylon'
										)}
									>
										{#if sorted}<ArrowDown class="size-3" />{/if}
										{column.short}
									</a>
								{:else}
									<span title={column.long} class="px-2.5">{column.short}</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each leaders.rows as row (row.player.id)}
						<tr class="border-b border-border last:border-0">
							<th
								scope="row"
								class="sticky left-0 z-10 bg-background py-2 pr-3 text-left font-normal"
							>
								<span class="flex items-center gap-3">
									<span class="w-5 text-right stat text-xs text-muted-foreground">{row.rank}</span>
									<Headshot src={row.player.headshot} class="hidden size-9 sm:block" />
									<span class="min-w-0">
										<a
											href={resolve('/players/[id=id]', { id: row.player.id })}
											class="block max-w-36 truncate font-medium hover:underline sm:max-w-none"
										>
											{row.player.name}
										</a>
										<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
											{row.player.position}
											{#if row.team}
												<TeamLogo team={row.team} class="size-4" />
												{row.team.abbreviation}
											{/if}
										</span>
									</span>
								</span>
							</th>
							{#each row.values as value, i (leaders.columns[i].key)}
								<td
									class={cn(
										'px-2.5 py-2 text-right stat last:pr-0',
										leaders.columns[i].key === leaders.sort
											? 'font-semibold'
											: 'text-muted-foreground'
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
	{:else}
		<p class="py-16 text-center text-muted-foreground">
			Nobody on the board for {leaders.season} yet.
		</p>
	{/if}
</div>
