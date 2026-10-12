<script lang="ts">
	import type { Team } from '#lib/types.js';
	import { cn } from '#lib/utils.js';

	let { team, class: className }: { team: Pick<Team, 'logo' | 'abbreviation'>; class?: string } =
		$props();
</script>

<img
	src={team.logo}
	alt=""
	loading="lazy"
	decoding="async"
	class={cn('size-8 shrink-0 object-contain', className)}
	title={team.abbreviation}
/>
