<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();
</script>

<!-- "PYLON" with an end-zone pylon standing in for the L: white letters, the pylon the only orange. It
     sits on the baseline and stands a touch taller than the capitals, as it would at the corner of the end
     zone. -->
<span
	aria-label="Pylon"
	class={cn(
		'inline-block font-display leading-none font-black tracking-wider whitespace-nowrap text-foreground uppercase',
		className
	)}
>
	<span aria-hidden="true">PY</span><svg
		aria-hidden="true"
		viewBox="0 0 11 40"
		class="mr-[0.07em] -ml-[0.02em] inline-block h-[0.96em] w-auto align-baseline"
	>
		<!-- The front face, the shaded side, and the top seen from a little above. -->
		<path d="M0 4h7v36H0z" fill="var(--pylon)" />
		<path d="M7 4l4-3v36l-4 3z" fill="color-mix(in oklab, var(--pylon) 65%, black)" />
		<path d="M0 4l4-3h7l-4 3z" fill="color-mix(in oklab, var(--pylon) 70%, white)" />
	</svg><span aria-hidden="true">ON</span>
</span>
