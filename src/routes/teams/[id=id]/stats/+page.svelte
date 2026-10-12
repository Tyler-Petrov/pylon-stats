<script lang="ts">
	import Stats from '#lib/components/team/stats.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<Stats teamId={params.id} />
