<script lang="ts">
	import { resolve } from '$app/paths';
	import { getStandings } from '#lib/nfl.remote.js';
	import { record, signed } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import type { StandingRow } from '#lib/types.js';

	let { teamId }: { teamId: string } = $props();

	const conferences = $derived(await getStandings());

	const division = $derived(
		conferences
			.flatMap((conference) => conference.divisions)
			.find((d) => d.teams.some((row) => row.team.id === teamId))
	);

	/** Games behind the division leader, the first row: "—" for the leader and anyone level with it. */
	function behind(row: StandingRow) {
		const leader = division!.teams[0];
		const games = (leader.wins - row.wins + (row.losses - leader.losses)) / 2;
		return games > 0 ? String(games) : '—';
	}

	const columns = 'grid-cols-[minmax(0,1fr)_3.5rem_2.25rem_3rem]';
</script>

{#if division}
	<section
		aria-labelledby="division-standings"
		class="overflow-hidden rounded-xl border border-border bg-card"
	>
		<header class="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2">
			<h2 id="division-standings" class="text-lg">{division.name}</h2>
			<a
				href={resolve('/standings')}
				class="text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				All standings
			</a>
		</header>
		<div
			aria-hidden="true"
			class={cn(
				'grid gap-2 border-b border-border px-4 pb-1.5 text-xs text-muted-foreground',
				columns
			)}
		>
			<span>Team</span>
			<span class="text-right">W-L</span>
			<span class="text-right">GB</span>
			<span class="text-right">Diff</span>
		</div>
		<ol>
			{#each division.teams as row (row.team.id)}
				{@const current = row.team.id === teamId}
				<li class="border-b border-border last:border-0">
					<a
						href={resolve('/teams/[id=id]', { id: row.team.id })}
						aria-current={current ? 'true' : undefined}
						aria-label="{row.team.name}: {record(row)}, {behind(row) === '—'
							? 'leads the division'
							: `${behind(row)} games back`}"
						class={cn(
							'relative grid items-center gap-2 px-4 py-2 text-sm transition-colors',
							columns,
							!current && 'hover:bg-accent'
						)}
					>
						<!-- Named for the page transition: moving to a rival's page, it slides to their row. -->
						{#if current}
							<span
								class="absolute inset-0 border-l-2 border-team bg-team/10 [view-transition-name:division-team]"
							></span>
						{/if}
						<span class="relative flex min-w-0 items-center gap-2.5">
							<TeamLogo team={row.team} class="size-6" />
							<span class={cn('truncate', current && 'font-medium')}>{row.team.nickname}</span>
						</span>
						<span class="relative text-right stat">{record(row)}</span>
						<span class="relative text-right stat text-muted-foreground">{behind(row)}</span>
						<span
							class={cn(
								'relative text-right stat',
								row.diff > 0 && 'text-turf',
								row.diff < 0 && 'text-flag'
							)}
						>
							{signed(row.diff)}
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}
