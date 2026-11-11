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

	/** Games behind the division leader, the first row. */
	function behind(row: StandingRow) {
		const leader = division!.teams[0];
		return Math.max(0, (leader.wins - row.wins + (row.losses - leader.losses)) / 2);
	}

	/** What a screen reader hears for a row: "Denver Broncos: 7-2, leads the division". */
	function label(row: StandingRow, i: number) {
		const games = behind(row);
		const standing = games
			? `${games} ${games === 1 ? 'game' : 'games'} back`
			: i === 0
				? 'leads the division'
				: 'tied for the division lead';
		return `${row.team.name}: ${record(row)}, ${standing}`;
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
			{#each division.teams as row, i (row.team.id)}
				{@const current = row.team.id === teamId}
				<li class="border-b border-border last:border-0">
					<!-- The team's own row goes to its schedule like the tab does, keeping the scroll. -->
					<a
						href={resolve('/teams/[id=id]', { id: row.team.id })}
						aria-current={current ? 'true' : undefined}
						aria-label={label(row, i)}
						data-sveltekit-reset={current ? 'false' : undefined}
						class={cn(
							'relative grid items-center gap-2 px-4 py-2 text-sm -outline-offset-2 transition-colors',
							columns,
							!current && 'hover:bg-accent'
						)}
					>
						<!-- Moving to a rival's page, the highlight slides to their row (lib/view-transitions.ts). -->
						{#if current}
							<span data-division-team class="absolute inset-0 border-l-2 border-team bg-team/10"
							></span>
						{/if}
						<span class="relative flex min-w-0 items-center gap-2.5">
							<TeamLogo team={row.team} class="size-6" />
							<span class={cn('truncate', current && 'font-medium')}>{row.team.nickname}</span>
						</span>
						<span class="relative text-right stat">{record(row)}</span>
						<span class="relative text-right stat text-muted-foreground">{behind(row) || '—'}</span>
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
