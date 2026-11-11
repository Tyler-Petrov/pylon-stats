<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getTeam } from '#lib/nfl.remote.js';
	import { streak } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { fadeIn } from '#lib/motion.js';
	import Division from '#lib/components/team/division.svelte';
	import type { LayoutProps } from './$types';

	let { params, children }: LayoutProps = $props();

	const team = $derived(await getTeam(params.id));

	const tabs = $derived([
		{ href: resolve('/teams/[id=id]', { id: params.id }), label: 'Schedule' },
		{ href: resolve('/teams/[id=id]/roster', { id: params.id }), label: 'Roster' },
		{ href: resolve('/teams/[id=id]/stats', { id: params.id }), label: 'Stats' }
	]);

	const facts = $derived(
		[
			{ label: 'Home', value: team.home },
			{ label: 'Away', value: team.road },
			{ label: 'Streak', value: streak(team.streak) },
			{ label: 'PF', value: team.pointsFor },
			{ label: 'PA', value: team.pointsAgainst }
		].filter((f) => f.value != null)
	);
</script>

<svelte:head>
	<title>{team.name} · Pylon</title>
</svelte:head>

<!-- `data-team-header` and `data-team-hero` are for the page transition (lib/view-transitions.ts): the header holds
     still between tabs, and the logo grows out of the one that was clicked to get here. The logos are new
     elements for each team, so the last team's logo never sits beside this one's name. -->
<div style:--team={team.color}>
	<header
		data-team-header
		class="relative overflow-hidden border-b border-border"
		style="background: linear-gradient(120deg, color-mix(in oklab, var(--team) 30%, transparent),
		transparent 70%)"
	>
		{#key team.id}
			<img
				src={team.logo}
				alt=""
				{@attach fadeIn}
				class="pointer-events-none absolute -top-10 -right-16 size-80 opacity-10 blur-[1px] md:right-0"
			/>
		{/key}
		<div
			class="relative page-column flex flex-col gap-5 pt-6 pb-6 md:flex-row md:items-end md:pt-10"
		>
			{#key team.id}
				<img
					src={team.logo}
					alt="{team.name} logo"
					data-team-hero
					{@attach fadeIn}
					class="size-24 object-contain md:size-32"
				/>
			{/key}
			<div class="min-w-0 flex-1">
				<!-- Back to Standings while the Teams page is hidden from the nav. -->
				<a
					href={resolve('/standings')}
					class="text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					{team.location}
				</a>
				<h1 class="text-5xl leading-none md:text-7xl">{team.nickname}</h1>
				{#if team.standing}
					<p class="mt-2 text-sm text-muted-foreground">{team.standing}</p>
				{/if}
			</div>
			<dl class="flex gap-5">
				<div>
					<dt class="text-xs text-muted-foreground">Record</dt>
					<dd class="stat text-4xl font-semibold">{team.record}</dd>
				</div>
				{#each facts as fact (fact.label)}
					<div class="hidden sm:block">
						<dt class="text-xs text-muted-foreground">{fact.label}</dt>
						<dd class="mt-2 stat text-lg">{fact.value}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</header>

	<!-- The division table sits beside the tabs on a wide screen, and above them on a narrow one. -->
	<div
		class="page-column grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]"
	>
		<aside class="lg:sticky lg:top-6 lg:order-last">
			<Division teamId={params.id} />
		</aside>

		<div class="min-w-0">
			<!-- Switching tabs keeps the scroll where it is. The underline is named for the page transition, so it
			     slides across to the tab that was picked. -->
			<nav aria-label={team.name} class="mb-5 flex gap-1 border-b border-border">
				{#each tabs as tab (tab.label)}
					{@const active = page.url.pathname === tab.href}
					<a
						href={tab.href}
						aria-current={active ? 'page' : undefined}
						data-sveltekit-reset="false"
						class={cn(
							'relative px-3 pb-2 text-base transition-colors',
							active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
						)}
					>
						{tab.label}
						{#if active}
							<span
								class="absolute inset-x-0 -bottom-px h-0.5 bg-team [view-transition-name:team-tab]"
							></span>
						{/if}
					</a>
				{/each}
			</nav>
			<!-- No boundary of its own: the tab's data comes with the page's (see the route loads, lib/warm.ts), so
			     the whole page arrives at once rather than the header first and the tab after. -->
			{@render children()}
		</div>
	</div>
</div>
