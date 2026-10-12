<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getTeam } from '#lib/nfl.remote.js';
	import { streak } from '#lib/format.js';
	import { cn } from '#lib/utils.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
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

<div style:--team={team.color}>
	<header
		class="relative overflow-hidden border-b border-border"
		style="background: linear-gradient(120deg, color-mix(in oklab, var(--team) 30%, transparent),
		transparent 70%)"
	>
		<img
			src={team.logo}
			alt=""
			class="pointer-events-none absolute -top-10 -right-16 size-80 opacity-10 blur-[1px] md:right-0"
		/>
		<div
			class="relative page-column flex flex-col gap-5 pt-6 pb-6 md:flex-row md:items-end md:pt-10"
		>
			<img src={team.logo} alt="{team.name} logo" class="size-24 object-contain md:size-32" />
			<div class="min-w-0 flex-1">
				<!-- Back to Standings while the Teams page is hidden from the nav. -->
				<a href={resolve('/standings')} class="text-sm text-muted-foreground hover:text-foreground">
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

	<div class="page-column pt-6">
		<nav aria-label={team.name} class="mb-5 flex gap-1 border-b border-border">
			{#each tabs as tab (tab.href)}
				{@const active = page.url.pathname === tab.href}
				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					data-sveltekit-noscroll
					class={cn(
						'-mb-px border-b-2 px-3 pb-2 text-base transition-colors',
						active
							? 'border-team text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'
					)}
				>
					{tab.label}
				</a>
			{/each}
		</nav>
		<!-- Each tab loads its own data. The header stays up meanwhile. -->
		<svelte:boundary>
			{@render children()}
			{#snippet pending()}
				<div class="grid gap-2">
					{#each { length: 6 }, i (i)}
						<Skeleton class="h-12 rounded-xl" />
					{/each}
				</div>
			{/snippet}
		</svelte:boundary>
	</div>
</div>
