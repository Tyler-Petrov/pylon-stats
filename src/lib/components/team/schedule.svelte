<script lang="ts">
	import { resolve } from '$app/paths';
	import { getSchedule, getStandings } from '#lib/nfl.remote.js';
	import { gameDay, kickoff, record } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import type { Conference, Game } from '#lib/types.js';

	let { teamId }: { teamId: string } = $props();

	// Standings give every opponent's record as it stands today; the team page's division table asks for
	// them too, so it's the same request. They're extra: without them the schedule just has no records.
	const [games, conferences] = $derived(
		await Promise.all([getSchedule(teamId), getStandings().catch((): Conference[] => [])])
	);

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
					<span class="w-4 shrink-0 text-muted-foreground">{home ? 'vs' : '@'}</span>
					<TeamLogo team={them.team} class="size-7" />
					<!-- The record goes under the name, as on a game card, so it never takes the name's room. Where the
					     row is narrow, the city gives way before the nickname does. -->
					<span class="min-w-0">
						<span class="flex gap-1">
							<span class="hidden min-w-0 shrink-[999] truncate group-hover:underline lg:inline">
								{them.team.location}
							</span>
							<span class="min-w-0 truncate font-medium group-hover:underline">
								{them.team.nickname}
							</span>
						</span>
						{#if records.has(them.team.id)}
							<span class="block stat text-xs text-muted-foreground" title="Current record">
								{records.get(them.team.id)}
							</span>
						{/if}
					</span>
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
					<!-- On a phone the date column is gone, so the day goes above the time, leaving the name its room. -->
					<span class="shrink-0 text-right text-muted-foreground">
						<span class="block sm:hidden">{gameDay(game.date)}</span>{kickoff(game.date)}
						{#if game.broadcast}<span class="hidden lg:inline"> · {game.broadcast}</span>{/if}
					</span>
				{/if}
			</div>
		{/if}
	{/each}
</div>
