<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { getLeaders } from '#lib/nfl.remote.js';
	import { leadersOf } from '#lib/query.js';
	import { cn } from '#lib/utils.js';
	import { indicator } from '#lib/motion.js';
	import Headshot from '#lib/components/headshot.svelte';
	import PageHeader from '#lib/components/page-header.svelte';
	import TeamLogo from '#lib/components/team-logo.svelte';

	// The category, the sorted column and the season are all in the address, so any table can be linked to and
	// the back button steps through the ones looked at.
	const leaders = $derived(await getLeaders(leadersOf(page.url)));

	/** This page showing something else. What the page shows by itself stays out of the address. */
	function href({ category, sort, season }: { category: string; sort?: string; season: number }) {
		const query = [
			category !== leaders.categories[0].key && `category=${category}`,
			sort && `sort=${sort}`,
			season !== leaders.seasons[0] && `season=${season}`
		]
			.filter(Boolean)
			.join('&');
		return query ? resolve(`/leaders?${query}`) : resolve('/leaders');
	}

	// The selected category's pill slides along the strip to the next one picked.
	const [send, receive] = indicator();
</script>

<PageHeader
	title="Leaders"
	description="{leaders.season} regular season · top {leaders.rows.length}"
>
	{#snippet actions()}
		<label class="flex items-center gap-2 text-sm text-muted-foreground">
			Season
			<select
				value={String(leaders.season)}
				onchange={(event) =>
					goto(
						href({
							category: leaders.category,
							sort: leaders.sort,
							season: Number(event.currentTarget.value)
						}),
						{ reset: false }
					)}
				class="rounded-full border border-border bg-card py-1 pr-2 pl-3 stat text-foreground"
			>
				{#each leaders.seasons as season (season)}
					<option value={String(season)}>{season}</option>
				{/each}
			</select>
		</label>
	{/snippet}
</PageHeader>

<div class="page-column">
	<nav
		aria-label="Categories"
		class="-mx-4 mb-6 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
	>
		<div class="flex w-max gap-1.5 pb-1">
			{#each leaders.categories as category (category.key)}
				{@const active = category.key === leaders.category}
				<a
					href={href({ category: category.key, season: leaders.season })}
					aria-current={active ? 'page' : undefined}
					data-sveltekit-reset="false"
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
					{category.label}
				</a>
			{/each}
		</div>
	</nav>

	{#if leaders.rows.length}
		<div class="overflow-x-auto rounded-xl border border-border bg-card">
			<table class="w-full text-sm whitespace-nowrap">
				<thead>
					<tr class="border-b border-border text-xs text-muted-foreground">
						<th scope="col" class="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium">
							Player
						</th>
						<!-- Each heading sorts the table by its column, most first. A sort is only fetched once it's
						     picked: a pointer crossing the row would otherwise ask ESPN for every column it passes. -->
						{#each leaders.columns as column (column.key)}
							{@const sorted = column.key === leaders.sort}
							<th
								scope="col"
								aria-sort={sorted ? 'descending' : undefined}
								class="py-2.5 text-right font-medium last:pr-1.5"
							>
								<a
									href={href({
										category: leaders.category,
										sort: column.key,
										season: leaders.season
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
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each leaders.rows as row (row.player.id)}
						<tr class="border-b border-border last:border-0">
							<th
								scope="row"
								class="sticky left-0 z-10 bg-card py-2 pr-3 pl-4 text-left font-normal"
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
										'px-2.5 py-2 text-right stat last:pr-4',
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
