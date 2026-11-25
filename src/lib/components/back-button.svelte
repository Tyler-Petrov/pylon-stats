<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let { fallback }: { fallback: ResolvedPathname } = $props();

	// Back to the screen this one was opened from. Tabs replace their history entry rather than add one, so that's
	// the last screen, not the last tab. Opened straight from a link (or the installed app's first screen), there's
	// nothing of Pylon's behind it, so it goes to `fallback` instead of out of the app. The Navigation API only
	// lists this site's own entries, which is what tells the two apart; without it, the link is the safe way.
	function back(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		const index = (window as { navigation?: { currentEntry?: { index: number } | null } })
			.navigation?.currentEntry?.index;
		if (index && index > 0) {
			event.preventDefault();
			history.back();
		}
	}
</script>

<a
	href={fallback}
	onclick={back}
	class="-ml-2 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2.5 pl-1 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
>
	<ChevronLeft class="size-4" />
	Back
</a>
