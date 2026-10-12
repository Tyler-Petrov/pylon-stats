<script lang="ts">
	import { resolve } from '$app/paths';
	import { getStandings } from '#lib/nfl.remote.js';
	import { signed } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import TeamLogo from '#lib/components/team-logo.svelte';

	const conferences = $derived(await getStandings());

	const columns = [
		{ label: 'W', title: 'Wins' },
		{ label: 'L', title: 'Losses' },
		{ label: 'T', title: 'Ties' },
		{ label: 'PCT', title: 'Win percentage' },
		{ label: 'PF', title: 'Points for', wide: true },
		{ label: 'PA', title: 'Points against', wide: true },
		{ label: 'DIFF', title: 'Point differential' },
		{ label: 'HOME', title: 'Home record', wide: true },
		{ label: 'AWAY', title: 'Road record', wide: true },
		{ label: 'DIV', title: 'Division record', wide: true },
		{ label: 'STRK', title: 'Streak' }
	];
</script>

<PageHeader
	title="Standings"
	description="Seeds are where teams would land if the season ended today"
/>

<div class="page-column grid gap-12">
	{#each conferences as conference (conference.name)}
		<section>
			<h2 class="mb-4 text-3xl text-pylon">{conference.name}</h2>
			<div class="grid gap-6">
				{#each conference.divisions as division (division.name)}
					<div class="overflow-x-auto rounded-xl border border-border bg-card">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-border text-xs text-muted-foreground">
									<th
										class="px-4 py-2.5 text-left font-display text-base font-bold tracking-wide text-foreground uppercase"
									>
										{division.name}
									</th>
									{#each columns as column (column.label)}
										<th
											title={column.title}
											class={cn(
												'px-2 py-2.5 text-right font-medium',
												column.wide && 'hidden md:table-cell'
											)}
										>
											{column.label}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each division.teams as row, i (row.team.id)}
									<tr class={cn('border-b border-border last:border-0', i === 0 && 'bg-turf/5')}>
										<td class="px-4 py-2">
											<a
												href={resolve('/teams/[id=id]', { id: row.team.id })}
												class="flex items-center gap-2.5 hover:underline"
											>
												<TeamLogo team={row.team} class="size-6" />
												<span class="hidden sm:inline">{row.team.name}</span>
												<span class="sm:hidden">{row.team.abbreviation}</span>
												{#if row.seed}
													<span class="stat text-xs text-muted-foreground" title="Playoff seed">
														{row.seed}
													</span>
												{/if}
											</a>
										</td>
										<td class="px-2 text-right stat">{row.wins}</td>
										<td class="px-2 text-right stat">{row.losses}</td>
										<td class="px-2 text-right stat">{row.ties}</td>
										<td class="px-2 text-right stat">{row.pct}</td>
										<td class="hidden px-2 text-right stat md:table-cell">{row.pointsFor}</td>
										<td class="hidden px-2 text-right stat md:table-cell">{row.pointsAgainst}</td>
										<td
											class={cn(
												'px-2 text-right stat',
												row.diff > 0 && 'text-turf',
												row.diff < 0 && 'text-flag'
											)}
										>
											{signed(row.diff)}
										</td>
										<td class="hidden px-2 text-right stat md:table-cell">{row.home}</td>
										<td class="hidden px-2 text-right stat md:table-cell">{row.road}</td>
										<td class="hidden px-2 text-right stat md:table-cell">{row.division}</td>
										<td class="px-2 pr-4 text-right stat">{row.streak}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
