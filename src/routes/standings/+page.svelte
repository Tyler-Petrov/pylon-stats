<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getStandings } from '#lib/nfl.remote.js';
	import { signed } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import type { Conference } from '#lib/types.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import TeamLogo from '#lib/components/team-logo.svelte';

	const conferences = $derived(await getStandings());

	// MOCK: ?mock=1 watermark, 2 edge shield, 3 banner.
	const mock = $derived(page.url.searchParams.get('mock') ?? '1');

	const fullNames: Record<string, string> = {
		AFC: 'American Football Conference',
		NFC: 'National Football Conference'
	};

	const columns = [
		{ label: 'W', title: 'Wins', width: 'w-9' },
		{ label: 'L', title: 'Losses', width: 'w-9' },
		{ label: 'T', title: 'Ties', width: 'w-9' },
		{ label: 'PCT', title: 'Win percentage', width: 'w-14' },
		{ label: 'PF', title: 'Points for', width: 'w-14', wide: true },
		{ label: 'PA', title: 'Points against', width: 'w-14', wide: true },
		{ label: 'DIFF', title: 'Point differential', width: 'w-14' },
		{ label: 'HOME', title: 'Home record', width: 'w-18', wide: true },
		{ label: 'AWAY', title: 'Road record', width: 'w-18', wide: true },
		{ label: 'DIV', title: 'Division record', width: 'w-18', wide: true },
		{ label: 'STRK', title: 'Streak', width: 'w-16' }
	];
</script>

<PageHeader
	title="Standings"
	description="Seeds are where teams would land if the season ended today"
/>

{#snippet divisions(conference: Conference, glass: boolean)}
	<div class="grid gap-6">
		{#each conference.divisions as division (division.name)}
			<div
				class={cn(
					'overflow-x-auto rounded-xl border border-border',
					glass ? 'bg-card/60 backdrop-blur-sm' : 'bg-card'
				)}
			>
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
										'px-2 py-2.5 text-right font-medium last:pr-4',
										column.width,
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
{/snippet}

<div class="page-column grid gap-12 pb-12">
	{#each conferences as conference (conference.name)}
		{#if mock === '1'}
			<!-- Watermark: the shield fills the middle of a framed panel, dimmed to a shadow. -->
			<section
				style:--conference={conference.color}
				class="relative isolate overflow-hidden rounded-3xl border border-border bg-[color-mix(in_oklab,var(--conference)_10%,var(--background))] p-3 md:p-6"
			>
				<img
					src={conference.logo}
					alt=""
					class="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[min(48rem,120%)] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-40 brightness-[0.3] saturate-[0.7]"
				/>
				<h2 class="mb-4 text-3xl text-pylon">{conference.name}</h2>
				{@render divisions(conference, true)}
			</section>
		{:else if mock === '2'}
			<!-- Edge shield: oversized and tipped off the outside edge, it rides along while you scroll
			     through the conference. -->
			{@const left = conference.name === 'AFC'}
			<section class="relative isolate">
				<div class="pointer-events-none absolute inset-y-0 -inset-x-4 -z-10 overflow-clip md:-inset-x-8">
					<div class="sticky top-0 h-dvh">
						<img
							src={conference.logo}
							alt=""
							class={cn(
								'absolute top-1/2 h-[min(95dvh,60rem)] max-w-none -translate-y-1/2 opacity-50 brightness-[0.28] saturate-[0.8]',
								left ? '-left-[22%] -rotate-12' : '-right-[22%] rotate-12'
							)}
						/>
					</div>
				</div>
				<header class="mb-5">
					<h2 class="text-5xl leading-none text-pylon">{conference.name}</h2>
					<p class="mt-1 text-sm text-muted-foreground">{fullNames[conference.name]}</p>
				</header>
				{@render divisions(conference, true)}
			</section>
		{:else}
			<!-- Banner: the shield is cropped huge behind a conference title band and fades out down the
			     first tables. -->
			<section style:--conference={conference.color} class="relative isolate">
				<div
					class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden rounded-3xl bg-linear-to-b from-[color-mix(in_oklab,var(--conference)_22%,var(--background))] to-transparent [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
				>
					<img
						src={conference.logo}
						alt=""
						class="absolute -top-[30%] right-[-8%] w-[min(52rem,130%)] max-w-none opacity-60 brightness-[0.3] saturate-[0.8]"
					/>
				</div>
				<header class="flex min-h-40 flex-col justify-end px-4 pt-10 pb-6 md:min-h-56 md:px-8">
					<p class="text-xs tracking-[0.2em] text-muted-foreground uppercase md:tracking-[0.3em]">
						{fullNames[conference.name]}
					</p>
					<h2 class="text-7xl leading-none md:text-8xl">{conference.name}</h2>
				</header>
				{@render divisions(conference, true)}
			</section>
		{/if}
	{/each}
</div>
