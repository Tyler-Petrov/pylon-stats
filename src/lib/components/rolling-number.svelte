<script lang="ts" module>
	import NumberFlow, { NumberFlowElement } from '@number-flow/svelte';

	// The library's own springy settle, a little quicker than it comes: a whole list of numbers moves at once.
	const ROLL = { ...NumberFlowElement.defaultProps.transformTiming, duration: 700 };
	const FADE = { duration: 300, easing: 'ease-out' };

	const PLAIN = /^-?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;
</script>

<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';

	let {
		value,
		suffix
	}: {
		/** A number as it's shown: "2,838", "63.0", "-0.7". Anything else ("33/49", "1-9", "--") shows as it is. */
		value: string;
		/** Words that follow the number and move with it as it widens: " games". */
		suffix?: string;
	} = $props();

	// Kept as it was written: the decimals it came with, and a comma only where there was one (ESPN writes a
	// career's 12050 attempts without).
	const number = $derived.by(() => {
		if (!PLAIN.test(value)) return null;
		const decimals = value.split('.')[1]?.length ?? 0;
		return {
			value: Number(value.replaceAll(',', '')),
			format: {
				useGrouping: value.includes(','),
				minimumFractionDigits: decimals,
				maximumFractionDigits: decimals
			}
		};
	});
</script>

<!--
	When the value changes, its digits roll to the new ones and the number widens or narrows to fit, instead of
	one number being swapped for another. The number takes its new room in the layout at once and only looks
	as if it grows into it, so what follows it on a line belongs in `suffix`. Standing still for anyone who asked
	for reduced motion.
-->
{#if number}
	<NumberFlow
		value={number.value}
		format={number.format}
		locales="en-US"
		{suffix}
		animated={!prefersReducedMotion.current}
		transformTiming={ROLL}
		opacityTiming={FADE}
	/>
{:else}
	{value}{suffix}
{/if}
