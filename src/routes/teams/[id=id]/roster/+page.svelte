<script lang="ts">
	import Roster from '#lib/components/team/roster.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<Roster teamId={params.id} />
