<script lang="ts">
	import { resolve } from '$app/paths';
	import { search } from '#lib/nfl.remote.js';
	import Headshot from './headshot.svelte';
	import TeamLogo from './team-logo.svelte';

	let { query }: { query: string } = $props();

	const results = $derived(await search(query));
</script>

{#if results.teams.length}
	<section class="mb-8">
		<h2 class="mb-3 text-xl text-muted-foreground">Teams</h2>
		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
			{#each results.teams as team (team.id)}
				<a
					href={resolve('/teams/[id=id]', { id: team.id })}
					style:--team={team.color}
					class="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-team/60 hover:bg-team/10"
				>
					<TeamLogo {team} class="size-11" />
					<div class="min-w-0">
						<p class="truncate text-xs text-muted-foreground">{team.location}</p>
						<p class="truncate font-display text-xl font-bold tracking-wide uppercase">
							{team.nickname}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if results.players.length}
	<section class="mb-8">
		<h2 class="mb-3 text-xl text-muted-foreground">Players</h2>
		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
			{#each results.players as player (player.id)}
				<a
					href={resolve('/players/[id=id]', { id: player.id })}
					style:--team={player.team?.color}
					class="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-team/50 hover:bg-team/5"
				>
					<Headshot src={player.headshot} class="size-12" />
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{player.name}</p>
						<p class="truncate text-xs text-muted-foreground">
							{[player.position, player.team?.name].filter(Boolean).join(' · ')}
						</p>
					</div>
					{#if player.jersey}
						<span class="stat text-lg font-semibold text-team">#{player.jersey}</span>
					{/if}
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if !results.teams.length && !results.players.length}
	<!-- ESPN's search only knows players who are on a roster now. -->
	<p class="py-16 text-center text-muted-foreground">
		No team or active player matches "{query}".
	</p>
{/if}
