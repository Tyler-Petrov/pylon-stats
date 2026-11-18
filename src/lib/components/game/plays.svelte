<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { getPlays } from '#lib/nfl.remote.js';
	import { period } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import TeamLogo from '#lib/components/team-logo.svelte';
	import type { GameDetail } from '#lib/types.js';

	let { game }: { game: GameDetail } = $props();

	// Through primitives: the page refreshes `game` every 30 seconds while it's on, and a new object that says
	// the same thing mustn't start the query, or the timer below, over again.
	const id = $derived(game.id);
	const live = $derived(game.state === 'in');

	const query = $derived(getPlays(id));
	const drives = $derived(await query);

	// While the game is on, keep up with it, as the page does with the score. The server caches ESPN for 20
	// seconds, and it's the response the score comes from, so this asks ESPN for nothing more.
	let watching: string | undefined;
	let ended = $state<string>();
	$effect(() => {
		const current = query;
		if (!live) {
			// The final whistle: one more look, for the plays since the timer's last.
			if (watching === id) {
				current.refresh();
				ended = id;
			}
			watching = undefined;
			return;
		}
		watching = id;
		const timer = setInterval(() => current.refresh(), 30_000);
		return () => clearInterval(timer);
	});

	// A drive goes under the quarter it started in, as a scoring play does under the one it happened in.
	const quarters = $derived([...Map.groupBy(drives, (drive) => drive.period)]);

	// The drive being played starts open and closes once the next one begins. A drive the reader opened or
	// closed themselves stays how they left it: a refresh would otherwise put it back. When the game ends
	// under a reader, its last drive stays open: that's where the plays they were waiting for arrive.
	const playing = $derived(live || ended === id ? drives.at(-1)?.id : undefined);
	const chosen = new SvelteMap<string, boolean>();
	function toggled(drive: string, open: boolean) {
		if (open === (drive === playing)) chosen.delete(drive);
		else chosen.set(drive, open);
	}
</script>

<section aria-labelledby="plays">
	<h2 id="plays" class="sr-only">Play-by-play</h2>
	<div class="text-sm">
		{#each quarters as [quarter, list] (quarter)}
			<h3
				class="border-b border-border pt-4 pb-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground first:pt-0"
			>
				{period(quarter, true)}
			</h3>
			{#each list as drive (drive.id)}
				<!-- One drive: how it ended and the score after it. Open it for every play. -->
				<details
					open={chosen.get(drive.id) ?? drive.id === playing}
					ontoggle={(event) => toggled(drive.id, event.currentTarget.open)}
					class="group border-b border-border last:border-0"
				>
					<summary
						class="flex list-none items-center gap-3 py-2.5 transition-colors hover:bg-foreground/[0.03] [&::-webkit-details-marker]:hidden"
					>
						{#if drive.team}
							<TeamLogo team={drive.team} class="size-6" />
						{:else}
							<span class="size-6 shrink-0"></span>
						{/if}
						<span class="min-w-0 flex-1">
							<span class={cn('font-semibold', drive.scored && 'text-pylon')}>
								{drive.result ?? (live ? 'In progress' : 'Drive')}
							</span>
							<span class="block truncate text-xs text-muted-foreground">{drive.summary}</span>
						</span>
						<!-- Away–home, like the header. A drive that scored picks out the side that did. -->
						{#if drive.score}
							<span class="shrink-0 stat text-muted-foreground">
								<span class={drive.score.by === 'away' ? 'font-semibold text-foreground' : ''}
									>{drive.score.away}</span
								>–<span class={drive.score.by === 'home' ? 'font-semibold text-foreground' : ''}
									>{drive.score.home}</span
								>
							</span>
						{/if}
						<ChevronDown
							class="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
						/>
					</summary>
					<ol class="border-t border-border/60">
						{#each drive.plays as play (play.id)}
							<li class="border-b border-border/60 py-2 pl-9 last:border-0">
								<p class="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
									<span class="stat"
										>{play.period <= 4 ? 'Q' : ''}{period(play.period)} {play.clock}</span
									>
									{#if play.down}<span>{play.down}</span>{/if}
								</p>
								<p class={cn('mt-0.5', play.scoring ? 'text-foreground' : 'text-muted-foreground')}>
									{play.text}
								</p>
							</li>
						{/each}
					</ol>
				</details>
			{/each}
		{:else}
			<p class="py-6 text-center text-muted-foreground">
				{live ? 'No plays yet.' : 'ESPN has no play-by-play for this game.'}
			</p>
		{/each}
	</div>
</section>
