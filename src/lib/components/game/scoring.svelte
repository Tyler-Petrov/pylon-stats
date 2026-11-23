<script lang="ts">
	import TeamLogo from '#lib/components/team-logo.svelte';
	import { period } from '#lib/format.js';
	import type { GameDetail } from '#lib/types.js';

	let { game }: { game: GameDetail } = $props();

	const quarters = $derived([...Map.groupBy(game.scoring, (play) => play.period)]);
</script>

<section aria-labelledby="scoring">
	<!-- The page's own tab says "Scoring" (routes/games/[id]), so the heading is only for a screen reader. -->
	<h2 id="scoring" class="sr-only">Scoring</h2>
	<div class="text-sm">
		{#each quarters as [quarter, plays] (quarter)}
			<h3
				class="border-b border-border pt-4 pb-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground first:pt-0"
			>
				{period(quarter, true)}
			</h3>
			<ol>
				{#each plays as play, i (i)}
					{@const awayScored = play.team.id === game.away.team.id}
					<li class="flex gap-3 border-b border-border py-2.5 last:border-0">
						<TeamLogo team={play.team} class="mt-0.5 size-6" />
						<div class="min-w-0 flex-1">
							<p>
								<span class="font-semibold">{play.kind}</span>
								<span class="stat text-xs text-muted-foreground">{play.clock}</span>
							</p>
							<p class="text-muted-foreground">{play.text}</p>
						</div>
						<!-- Away–home, like the header, with the side that just scored picked out. -->
						<p class="shrink-0 stat text-muted-foreground">
							<span class={awayScored ? 'font-semibold text-foreground' : ''}>{play.away}</span
							>–<span class={awayScored ? '' : 'font-semibold text-foreground'}>{play.home}</span>
						</p>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="py-6 text-center text-muted-foreground">No points yet.</p>
		{/each}
	</div>
</section>
