<script lang="ts">
	import type { Team } from '#lib/types.js';
	import { cn } from '#lib/utils.js';
	import { fadeIn } from '#lib/motion.js';

	let {
		team,
		class: className
	}: { team: Pick<Team, 'id' | 'logo' | 'abbreviation'>; class?: string } = $props();
</script>

<!-- `data-team-logo` is how a page transition finds the logo to grow into the team's page (lib/view-transitions.ts). -->
<img
	src={team.logo}
	alt=""
	loading="lazy"
	decoding="async"
	data-team-logo={team.id}
	{@attach fadeIn}
	class={cn('size-8 shrink-0 object-contain', className)}
	title={team.abbreviation}
/>
