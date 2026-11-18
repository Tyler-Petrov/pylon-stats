<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { resolve } from '$app/paths';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { getSearchResults } from '#lib/nfl.remote.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import Headshot from './headshot.svelte';
	import TeamLogo from './team-logo.svelte';
	import type { SearchResults } from '#lib/types.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// What's typed, and what's searched for: the search trails the typing by a pause. Both outlive the panel,
	// so opening it again finds the last search still there.
	let text = $state('');
	let asked = $state('');
	let timer: ReturnType<typeof setTimeout>;
	function typed() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			// Cut to what the remote function takes, and trimmed again after the cut as it will be there.
			const q = text.trim().slice(0, 40).trim();
			asked = q.length >= 2 ? q : '';
		}, 250);
	}
	$effect(() => () => clearTimeout(timer));

	const query = $derived(asked ? getSearchResults(asked) : undefined);

	// The last results stay up while the next are on their way, so the list doesn't blink with every letter.
	// Each is kept with the search it answers.
	let last: { for: string; results: SearchResults } | undefined;
	const shown = $derived.by(() => {
		if (!asked) return (last = undefined);
		if (query?.current) last = { for: asked, results: query.current };
		return last;
	});
	const results = $derived(shown?.results);
	const failed = $derived(Boolean(query?.error) && !query?.loading);
	const empty = $derived(results && !results.teams.length && !results.players.length);
	// Typed past what's listed: the list stays up, faded, but Enter can't open a result for the old text.
	const stale = $derived(Boolean(shown) && text.trim().slice(0, 40).trim() !== shown?.for);

	const item =
		'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 outline-none data-selected:bg-foreground/10';
</script>

<!-- Search from anywhere: a pane of glass over the page, with what it finds listed in it. -->
<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-background/30" />
		<Dialog.Content
			aria-describedby={undefined}
			class="fixed top-[max(1rem,12vh)] left-1/2 z-50 w-[min(38rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-foreground/15 bg-card/45 shadow-2xl shadow-black/60 backdrop-blur-xl outline-none"
		>
			<Dialog.Title class="sr-only">Search</Dialog.Title>
			<Command.Root shouldFilter={false} loop label="Search teams and players">
				<div class="flex items-center gap-3 border-b border-foreground/10 px-4">
					{#if query?.loading}
						<Spinner class="size-4 shrink-0 text-muted-foreground" />
					{:else}
						<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
					{/if}
					<!-- Opening it again is asking to type something new: the old search is selected, ready to go. -->
					<Command.Input
						bind:value={text}
						oninput={typed}
						onfocus={(event) => event.currentTarget.select()}
						placeholder="A team or an active player"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						enterkeyhint="search"
						maxlength={40}
						class="h-13 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
					/>
					<kbd
						class="hidden shrink-0 rounded-md border border-foreground/15 px-1.5 py-0.5 font-sans text-[0.7rem] text-muted-foreground md:block"
					>
						Esc
					</kbd>
				</div>
				<Command.List class="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2">
					<Command.Viewport class={stale ? 'opacity-60' : undefined}>
						{#if failed}
							<div class="flex flex-col items-center gap-2 py-10 text-center text-sm">
								<p class="text-muted-foreground">Couldn't search just now.</p>
								<button
									type="button"
									class="text-pylon underline-offset-4 hover:underline"
									onclick={() => query?.refresh()}
								>
									Try again
								</button>
							</div>
							<!-- Nothing yet, or nothing for what was typed before: the new search's answer is on its way. -->
						{:else if !results || (empty && stale)}
							<p class="py-10 text-center text-sm text-muted-foreground">
								{asked ? 'Searching…' : "Type two letters or more of a team or a player's name."}
							</p>
						{:else if empty}
							<!-- ESPN's search knows the players it still ties to a team, not those long retired. -->
							<p class="py-10 text-center text-sm text-muted-foreground">
								No team or active player matches "{asked}".
							</p>
						{:else}
							{#if results.teams.length}
								<Command.Group>
									<Command.GroupHeading class="px-3 pt-1 pb-1.5 text-xs text-muted-foreground">
										Teams
									</Command.GroupHeading>
									<Command.GroupItems>
										{#each results.teams as team (team.id)}
											<Command.LinkItem
												value="team-{team.id}"
												href={stale ? undefined : resolve('/teams/[id=id]', { id: team.id })}
												disabled={stale}
												onSelect={() => (open = false)}
												class={item}
											>
												<TeamLogo {team} class="size-9" />
												<span class="min-w-0">
													<span class="block truncate font-medium">{team.name}</span>
													<span class="block text-xs text-muted-foreground"
														>{team.abbreviation}</span
													>
												</span>
											</Command.LinkItem>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
							{#if results.players.length}
								<Command.Group>
									<Command.GroupHeading class="px-3 pt-2 pb-1.5 text-xs text-muted-foreground">
										Players
									</Command.GroupHeading>
									<Command.GroupItems>
										{#each results.players as player (player.id)}
											<Command.LinkItem
												value="player-{player.id}"
												href={stale ? undefined : resolve('/players/[id=id]', { id: player.id })}
												disabled={stale}
												onSelect={() => (open = false)}
												class={item}
											>
												<Headshot src={player.headshot} class="size-9" />
												<span class="min-w-0 flex-1">
													<span class="block truncate font-medium">{player.name}</span>
													<span class="block truncate text-xs text-muted-foreground">
														{[player.position, player.team?.name].filter(Boolean).join(' · ')}
													</span>
												</span>
												{#if player.jersey}
													<span class="stat text-sm text-muted-foreground">#{player.jersey}</span>
												{/if}
											</Command.LinkItem>
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{/if}
						{/if}
					</Command.Viewport>
				</Command.List>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
