<script lang="ts">
	import Scoreboard from '#lib/components/scoreboard.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<Scoreboard week={params.week} seasonType={params.seasonType} />
