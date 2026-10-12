<script lang="ts">
	import { resolve } from '$app/paths';
	import { getRoster } from '#lib/nfl.remote.js';
	import { cn } from '#lib/utils.js';
	import type { Player } from '#lib/types.js';

	let { teamId }: { teamId: string } = $props();

	const roster = $derived(await getRoster(teamId));
</script>

{#snippet headshot(player: Player, size: string)}
	<div class={cn('relative shrink-0 overflow-hidden rounded-full bg-muted', size)}>
		{#if player.headshot}
			<img
				src={player.headshot}
				alt=""
				loading="lazy"
				class="absolute top-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover"
			/>
		{/if}
	</div>
{/snippet}

{#snippet injury(player: Player)}
	{#if player.injury}
		<span
			class={cn(
				'rounded px-1.5 text-[0.65rem] font-semibold whitespace-nowrap uppercase',
				player.injury === 'Questionable' ? 'bg-pylon/15 text-pylon' : 'bg-flag/15 text-flag'
			)}
		>
			{player.injury}
		</span>
	{/if}
{/snippet}

{#snippet card(player: Player)}
	<a
		href={resolve('/players/[id=id]', { id: player.id })}
		class="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-team/50 hover:bg-team/5"
	>
		{@render headshot(player, 'size-12')}
		<div class="min-w-0 flex-1">
			<p class="truncate font-medium">{player.name}</p>
			<p class="truncate text-xs text-muted-foreground">
				{[player.position, player.height, player.weight, player.college]
					.filter(Boolean)
					.join(' · ')}
			</p>
		</div>
		<div class="flex flex-col items-end gap-1">
			{#if player.jersey}
				<span class="stat text-lg font-semibold text-team">#{player.jersey}</span>
			{/if}
			{@render injury(player)}
		</div>
	</a>
{/snippet}

{#if roster.coach}
	<p class="mb-4 text-sm text-muted-foreground">
		Head coach <span class="text-foreground">{roster.coach}</span>
	</p>
{/if}

<!-- The depth chart: one row per spot in the lineup, the starter first and the backups after in order. -->
<div class="grid grid-cols-[minmax(0,1fr)] gap-10">
	{#each roster.depth as unit (unit.formation)}
		<section>
			<h3 class="mb-3 flex items-baseline gap-2 text-2xl">
				{unit.name}
				<!-- Special teams' formation is just "Special Teams" again. -->
				{#if unit.formation.toLowerCase() !== unit.name.toLowerCase()}
					<span
						class="font-sans text-xs font-normal tracking-normal text-muted-foreground normal-case"
					>
						{unit.formation}
					</span>
				{/if}
			</h3>
			<div class="overflow-hidden rounded-xl border border-border">
				{#each unit.slots as slot, i (`${slot.label}-${i}`)}
					{@const [starter, ...backups] = slot.players}
					<div
						class="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2.5 last:border-0 md:grid-cols-[3.25rem_minmax(0,22rem)_1fr]"
					>
						<!-- Just a hint of the team colour: the labels are there to scan, not to compete with the names. -->
						<span
							class="stat text-xs font-medium text-[color-mix(in_oklab,var(--team)_65%,var(--muted-foreground))]"
						>
							{slot.label}
						</span>
						{#if starter}
							<a
								href={resolve('/players/[id=id]', { id: starter.id })}
								class="flex min-w-0 items-center gap-3 rounded-lg hover:text-team"
							>
								{@render headshot(starter, 'size-10')}
								<span class="min-w-0 truncate font-medium">{starter.name}</span>
								{#if starter.jersey}
									<span class="-ml-1.5 stat text-sm text-muted-foreground">#{starter.jersey}</span>
								{/if}
								{@render injury(starter)}
							</a>
						{/if}
						<div class="col-start-2 flex flex-wrap gap-x-4 gap-y-1 md:col-start-3">
							{#each backups as backup (backup.id)}
								<a
									href={resolve('/players/[id=id]', { id: backup.id })}
									class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
								>
									{backup.name}
									{#if backup.jersey}
										<span class="stat text-xs text-muted-foreground/60">#{backup.jersey}</span>
									{/if}
									{@render injury(backup)}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}

	{#each roster.groups as group (group.name)}
		<section>
			<h3 class="mb-2 flex items-baseline gap-2 text-lg">
				{group.name}
				<span class="stat text-xs font-normal text-muted-foreground">{group.players.length}</span>
			</h3>
			<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
				{#each group.players as player (player.id)}
					{@render card(player)}
				{/each}
			</div>
		</section>
	{/each}
</div>
