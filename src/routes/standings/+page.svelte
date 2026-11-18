<script lang="ts">
	import { resolve } from '$app/paths';
	import { getStandings } from '#lib/nfl.remote.js';
	import { signed } from '#lib/format.js';
	import { fadeIn } from '#lib/motion.js';
	import { cn } from '#lib/utils.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import TeamLogo from '#lib/components/team-logo.svelte';

	const conferences = $derived(await getStandings());

	const fullNames: Record<string, string> = {
		AFC: 'American Football Conference',
		NFC: 'National Football Conference'
	};

	/* Every division's table gets the same widths (`table-fixed`), so the columns line up down the page and the
	   team column takes what's left. Widths and which columns show go by the width of the tables, not the
	   window, since the sidebar takes a share of it on larger screens: phones (under 30rem) get the core stats,
	   points come in at 40rem, and the home, road and division records at 42rem. Below 54rem it's all a little
	   tighter. From the md breakpoint every column shows, as it always has, and a table too narrow for them all
	   scrolls sideways. */
	const narrow = 'w-7 @min-[30rem]:w-8 @min-[54rem]:w-9';
	const medium = 'w-11 @min-[30rem]:w-12 @min-[54rem]:w-14';
	const points = 'hidden @min-[40rem]:table-cell md:table-cell';
	const splits = 'hidden @min-[42rem]:table-cell md:table-cell';
	const columns = [
		{ label: 'W', title: 'Wins', width: narrow },
		{ label: 'L', title: 'Losses', width: narrow },
		{ label: 'T', title: 'Ties', width: narrow },
		{ label: 'PCT', title: 'Win percentage', width: medium },
		{ label: 'PF', title: 'Points for', width: 'w-11 @min-[54rem]:w-14', show: points },
		{ label: 'PA', title: 'Points against', width: 'w-11 @min-[54rem]:w-14', show: points },
		{ label: 'DIFF', title: 'Point differential', width: medium },
		{ label: 'HOME', title: 'Home record', width: 'w-14 @min-[54rem]:w-18', show: splits },
		{ label: 'AWAY', title: 'Road record', width: 'w-14 @min-[54rem]:w-18', show: splits },
		{ label: 'DIV', title: 'Division record', width: 'w-14 @min-[54rem]:w-18', show: splits },
		{ label: 'STRK', title: 'Streak', width: 'w-10 @min-[30rem]:w-12 @min-[54rem]:w-16' }
	];
</script>

<PageHeader
	title="Standings"
	description="Seeds 1–7 would make the playoffs if the season ended today"
/>

<div class="page-column grid gap-10 pb-12 md:gap-12">
	{#each conferences as conference (conference.name)}
		<!-- Each conference sits on a wash of its own colour, with its shield darkened behind the title band. The
		     NFC's navy is much darker than the AFC's red, so its shield is dimmed less to read the same. -->
		{@const nfc = conference.name === 'NFC'}
		<section
			style:--conference={conference.color}
			aria-labelledby="conference-{conference.name}"
			class="relative isolate -mx-2 overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--conference)_25%,var(--border))] bg-[color-mix(in_oklab,var(--conference)_6%,var(--background))] p-2 sm:mx-0 sm:rounded-3xl sm:p-4 md:p-5"
		>
			<div
				class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden bg-linear-to-b from-[color-mix(in_oklab,var(--conference)_24%,var(--background))] to-transparent mask-[linear-gradient(to_bottom,black_45%,transparent)] md:h-96"
			>
				<img
					src={conference.logo}
					alt=""
					aria-hidden="true"
					draggable="false"
					decoding="async"
					{@attach fadeIn}
					class={cn(
						'absolute -top-4 -right-6 w-48 max-w-none rotate-8 sm:w-72 md:-top-6 md:right-4 md:w-96',
						nfc ? 'opacity-55 brightness-[0.5] saturate-[0.9]' : 'opacity-45 brightness-[0.38]'
					)}
				/>
				<!-- Keeps the title clear of the shield on narrow screens. -->
				<div
					class="absolute inset-0 bg-linear-to-r from-background/60 via-background/20 to-transparent"
				></div>
			</div>

			<header class="px-2 pt-4 pb-5 sm:px-1 md:pt-6 md:pb-7">
				<h2 id="conference-{conference.name}" class="text-6xl leading-none md:text-7xl">
					<span
						class="mb-0.5 block font-sans text-[0.7rem] leading-tight font-medium tracking-[0.25em] text-foreground/65"
					>
						{fullNames[conference.name] ?? conference.name}
					</span>
					{conference.name}
				</h2>
			</header>

			<div class="@container grid gap-3 sm:gap-4">
				{#each conference.divisions as division (division.name)}
					<div class="overflow-x-auto rounded-xl border border-border bg-card">
						<table class="w-full min-w-[19.25rem] table-fixed text-sm md:min-w-[41.75rem]">
							<thead>
								<tr
									class="border-b border-border bg-[color-mix(in_oklab,var(--conference)_7%,var(--card))] text-xs text-muted-foreground"
								>
									<th
										class="truncate px-2.5 py-2.5 text-left font-display text-base font-bold tracking-wide text-foreground uppercase @min-[30rem]:px-4"
									>
										{division.name}
									</th>
									{#each columns as column (column.label)}
										<th
											title={column.title}
											class={cn(
												'px-1 py-2.5 text-right font-medium last:pr-2.5 @min-[30rem]:px-1.5 @min-[30rem]:last:pr-4 @min-[54rem]:px-2',
												column.width,
												column.show
											)}
										>
											{column.label}
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each division.teams as row (row.team.id)}
									{@const playoff = row.seed !== null && row.seed <= 7}
									<tr
										style:--team={row.team.color}
										class="border-b border-border transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--team)_12%,var(--card))] [&>td]:px-1 [&>td]:text-right [&>td]:stat @min-[30rem]:[&>td]:px-1.5 @min-[54rem]:[&>td]:px-2 [&>td:last-child]:pr-2.5 @min-[30rem]:[&>td:last-child]:pr-4"
									>
										<td class="p-0!">
											<a
												href={resolve('/teams/[id=id]', { id: row.team.id })}
												class="flex min-w-0 items-center gap-1.5 px-2.5 py-2 font-sans -outline-offset-2 hover:underline @min-[30rem]:gap-2.5 @min-[30rem]:px-4"
											>
												<TeamLogo team={row.team} class="size-6 shrink-0" />
												<!-- The full name where there's room for it, the nickname in narrower tables, the abbreviation on phones. -->
												<span class="hidden truncate @min-[54rem]:inline">{row.team.name}</span>
												<span class="hidden truncate @min-[30rem]:inline @min-[54rem]:hidden"
													>{row.team.nickname}</span
												>
												<span class="@min-[30rem]:hidden">{row.team.abbreviation}</span>
												{#if row.seed}
													<span
														title={playoff ? `Playoff seed ${row.seed}` : `Seed ${row.seed}`}
														class={cn(
															'shrink-0 stat text-xs',
															playoff
																? 'rounded bg-turf/15 px-1.5 text-turf'
																: 'text-muted-foreground'
														)}
													>
														{row.seed}
													</span>
												{/if}
											</a>
										</td>
										<td>{row.wins}</td>
										<td>{row.losses}</td>
										<td>{row.ties}</td>
										<td>{row.pct}</td>
										<td class={points}>{row.pointsFor}</td>
										<td class={points}>{row.pointsAgainst}</td>
										<td class={cn(row.diff > 0 && 'text-turf', row.diff < 0 && 'text-flag')}>
											{signed(row.diff)}
										</td>
										<td class={splits}>{row.home}</td>
										<td class={splits}>{row.road}</td>
										<td class={splits}>{row.division}</td>
										<td>{row.streak}</td>
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
