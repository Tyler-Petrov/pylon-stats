<script lang="ts">
	import { resolve } from '$app/paths';
	import { getSchedule, getStandings } from '#lib/nfl.remote.js';
	import { gameDay, kickoff, record } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import type { Game } from '#lib/types.js';

	let { teamId }: { teamId: string } = $props();

	// Standings give every opponent's record as it stands today; the team page's division table asks for
	// them too, so it's the same request.
	const [games, conferences] = $derived(await Promise.all([getSchedule(teamId), getStandings()]));

	const records = $derived(
		new Map(
			conferences
				.flatMap((c) => c.divisions.flatMap((d) => d.teams))
				.map((row) => [row.team.id, record(row)])
		)
	);

	// ESPN leaves the bye out of the schedule; put it back where the gap in week numbers is.
	type Row = { kind: 'game'; game: Game } | { kind: 'bye'; week: number };
	const rows = $derived.by(() => {
		const result: Row[] = [];
		let expected = 1;
		for (const game of games) {
			if (game.week && game.week > expected) result.push({ kind: 'bye', week: expected });
			result.push({ kind: 'game', game });
			expected = (game.week ?? expected) + 1;
		}
		return result;
	});

	function view(game: Game) {
		const us = game.home.team.id === teamId ? game.home : game.away;
		const them = us === game.home ? game.away : game.home;
		return { us, them, home: us === game.home };
	}
</script>

<div class="overflow-hidden rounded-xl border border-border bg-card">
	{#each rows as row (row.kind === 'game' ? row.game.id : `bye-${row.week}`)}
		{#if row.kind === 'bye'}
			<div class="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-sm">
				<span class="w-9 stat text-muted-foreground">{row.week}</span>
				<span class="font-display text-lg font-bold tracking-widest text-muted-foreground uppercase"
					>Bye</span
				>
			</div>
		{:else}
			{@const game = row.game}
			{@const { us, them, home } = view(game)}
			<div class="flex items-center gap-4 border-b border-border px-4 py-2.5 text-sm last:border-0">
				<span class="w-9 stat text-muted-foreground">{game.week ?? ''}</span>
				<span class="hidden w-28 text-muted-foreground sm:block">{gameDay(game.date)}</span>
				<a
					href={resolve('/teams/[id=id]', { id: them.team.id })}
					class="group flex min-w-0 flex-1 items-center gap-2.5"
				>
					<span class="w-4 text-muted-foreground">{home ? 'vs' : '@'}</span>
					<TeamLogo team={them.team} class="size-7" />
					<span class="truncate group-hover:underline">
						<span class="hidden md:inline">{them.team.location}</span>
						<span class="font-medium">{them.team.nickname}</span>
					</span>
					{#if records.has(them.team.id)}
						<span class="shrink-0 stat text-xs text-muted-foreground" title="Current record">
							{records.get(them.team.id)}
						</span>
					{/if}
				</a>
				{#if game.state === 'post'}
					<span class="flex items-center gap-2 stat">
						<span
							class={cn(
								'w-4 font-semibold',
								us.winner ? 'text-turf' : them.winner ? 'text-flag' : 'text-muted-foreground'
							)}
						>
							{us.winner ? 'W' : them.winner ? 'L' : 'T'}
						</span>
						{us.score}–{them.score}
					</span>
				{:else if game.state === 'in'}
					<span class="stat font-semibold text-pylon">{us.score}–{them.score} · {game.detail}</span>
				{:else}
					<span class="text-right text-muted-foreground">
						<span class="sm:hidden">{gameDay(game.date)} · </span>{kickoff(game.date)}
						{#if game.broadcast}<span class="hidden md:inline"> · {game.broadcast}</span>{/if}
					</span>
				{/if}
			</div>
		{/if}
	{/each}
</div>
