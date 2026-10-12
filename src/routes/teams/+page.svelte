<script lang="ts">
	import { resolve } from '$app/paths';
	import { getStandings } from '#lib/nfl.remote.js';
	import PageHeader from '#lib/components/page-header.svelte';
	import TeamLogo from '#lib/components/team-logo.svelte';

	const conferences = $derived(await getStandings());
</script>

<PageHeader title="Teams" description="All 32, by division" />

<div class="page-column grid gap-8">
	{#each conferences as conference (conference.name)}
		{@const left = conference.name === 'AFC'}
		<!-- Each conference sits on a wash of its own colour, its shield tipped toward the outside edge:
		     the AFC's to the left, the NFC's to the right. -->
		<section
			style:--conference={conference.color}
			class="relative isolate overflow-hidden rounded-2xl bg-[color-mix(in_oklab,var(--conference)_7%,transparent)] p-4 md:p-6"
		>
			<img
				src={conference.logo}
				alt=""
				class={[
					'pointer-events-none absolute top-1/2 -z-10 w-[min(26rem,60%)] max-w-none -translate-y-1/2 opacity-[0.08]',
					left ? '-left-[4%] -rotate-12' : '-right-[4%] rotate-12'
				]}
			/>
			<h2 class="mb-4 text-3xl text-pylon">{conference.name}</h2>
			<div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
				{#each conference.divisions as division (division.name)}
					<div>
						<h3 class="mb-2 text-sm tracking-widest text-muted-foreground">{division.name}</h3>
						<div class="grid gap-2">
							{#each division.teams as row (row.team.id)}
								<a
									href={resolve('/teams/[id=id]', { id: row.team.id })}
									style:--team={row.team.color}
									class="group flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card/75 p-3 backdrop-blur-sm transition-colors hover:border-team/60 hover:bg-team/10"
								>
									<TeamLogo team={row.team} class="size-11" />
									<div class="min-w-0 flex-1">
										<p class="truncate text-xs text-muted-foreground">{row.team.location}</p>
										<p class="truncate font-display text-xl font-bold tracking-wide uppercase">
											{row.team.nickname}
										</p>
									</div>
									<span class="stat text-sm text-muted-foreground group-hover:text-foreground">
										{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ''}
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
