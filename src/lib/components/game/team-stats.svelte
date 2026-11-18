<script lang="ts">
	import TeamLogo from '#lib/components/team-logo.svelte';
	import { cn } from '#lib/utils.js';
	import type { GameDetail } from '#lib/types.js';

	let { game }: { game: GameDetail } = $props();
</script>

<!-- Away on the left and home on the right, as in the header above. -->
<section aria-labelledby="team-stats">
	<h2 id="team-stats" class="mb-3 text-2xl">{game.teamStats.title}</h2>
	<div class="text-sm">
		<div
			class="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 border-b border-border pb-2"
		>
			<TeamLogo team={game.away.team} class="size-6" />
			<span></span>
			<TeamLogo team={game.home.team} class="size-6 justify-self-end" />
		</div>
		<table class="w-full">
			<thead class="sr-only">
				<tr>
					<th>{game.away.team.name}</th>
					<th>Stat</th>
					<th>{game.home.team.name}</th>
				</tr>
			</thead>
			<tbody>
				{#each game.teamStats.rows as row (row.label + row.sub)}
					<tr
						class={cn('border-b border-border last:border-0', row.sub && 'text-muted-foreground')}
					>
						<td class="w-16 py-2 stat">{row.away}</td>
						<th
							scope="row"
							class={cn(
								'px-2 py-2 text-center font-normal',
								row.sub ? 'text-xs' : 'text-muted-foreground'
							)}
						>
							{row.label}
						</th>
						<td class="w-16 py-2 text-right stat">{row.home}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
