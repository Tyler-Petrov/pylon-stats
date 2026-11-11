<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Game, GameSide } from '#lib/types.js';
	import { kickoff } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { duration } from '#lib/motion.js';
	import { fly, slide } from 'svelte/transition';
	import TeamLogo from './team-logo.svelte';

	let { game }: { game: Game } = $props();

	const live = $derived(game.state === 'in');
	const final = $derived(game.state === 'post');
</script>

{#snippet side(s: GameSide)}
	{@const lost = final && s.winner === false}
	{@const hasBall = live && game.situation?.possession === s.team.id}
	<div class="flex items-center gap-3">
		<TeamLogo team={s.team} class="size-9" />
		<a
			href={resolve('/teams/[id=id]', { id: s.team.id })}
			class={cn('min-w-0 flex-1 hover:underline', lost && 'text-muted-foreground')}
		>
			<span class="block truncate font-medium">
				{s.team.location}
				<span class="font-display text-lg font-bold tracking-wide uppercase">{s.team.nickname}</span
				>
			</span>
			{#if s.record}
				<span class="stat text-xs text-muted-foreground">{s.record}</span>
			{/if}
		</a>
		<!-- While a game is on, both sides keep a place for the ball, so it fades across when a drive changes
		     hands rather than nudging the names. A new score drops in. -->
		{#if live}
			<span
				class={cn(
					'size-1.5 rounded-full bg-pylon transition-opacity duration-300',
					!hasBall && 'opacity-0'
				)}
				title={hasBall ? 'Possession' : undefined}
			></span>
		{/if}
		{#if s.score != null && game.state !== 'pre'}
			<span
				class={cn(
					'w-10 text-right stat text-2xl font-semibold transition-colors',
					lost && 'text-muted-foreground',
					final && s.winner && 'text-foreground'
				)}
			>
				{#key s.score}
					<span class="inline-block" in:fly={{ y: -8, duration: duration(220) }}>{s.score}</span>
				{/key}
			</span>
		{/if}
	</div>
{/snippet}

<article
	class={cn(
		'flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors duration-500',
		live ? 'border-pylon/60' : 'border-border'
	)}
>
	<header class="flex items-center justify-between gap-2 text-xs">
		{#if live}
			<span class="flex items-center gap-1.5 font-semibold text-pylon uppercase">
				<span class="relative flex size-2">
					<span
						class="absolute inline-flex size-full rounded-full bg-pylon opacity-75 motion-safe:animate-ping"
					></span>
					<span class="relative inline-flex size-2 rounded-full bg-pylon"></span>
				</span>
				{game.detail}
			</span>
		{:else if final}
			<span class="font-semibold text-muted-foreground uppercase">{game.detail}</span>
		{:else}
			<!-- The scoreboard groups games by day, so the card only needs the time. -->
			<span class="font-semibold">{kickoff(game.date)}</span>
		{/if}
		{#if game.broadcast}
			<span class="truncate text-muted-foreground">{game.broadcast}</span>
		{/if}
	</header>

	{@render side(game.away)}
	{@render side(game.home)}

	<!-- At kickoff the venue line gives way to the down and distance, which goes again at the final whistle. -->
	{#if live && game.situation?.downDistance}
		<p
			transition:slide={{ duration: duration() }}
			class={cn(
				'rounded-md bg-muted px-2.5 py-1.5 text-xs transition-colors',
				game.situation.redZone && 'bg-flag/15 text-flag'
			)}
		>
			{game.situation.downDistance}
			{#if game.situation.lastPlay}
				<span class="mt-0.5 line-clamp-2 min-h-8 text-muted-foreground"
					>{game.situation.lastPlay}</span
				>
			{/if}
		</p>
	{:else if game.state === 'pre' && (game.odds || game.venue)}
		<p
			transition:slide={{ duration: duration() }}
			class="flex justify-between gap-2 text-xs text-muted-foreground"
		>
			<span class="truncate">{game.venue}</span>
			{#if game.odds}<span class="shrink-0 stat">{game.odds}</span>{/if}
		</p>
	{/if}
</article>
