<script lang="ts">
	import Schedule from '#lib/components/team/schedule.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<Schedule teamId={params.id} />
