<script lang="ts">
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import { summarize, type PresetEntry } from '$lib/presets/library';

	let { entry, onpick }: { entry: PresetEntry; onpick: () => void } = $props();

	const tags = $derived(summarize(entry.preset.graph));
</script>

<button
	type="button"
	onclick={onpick}
	class="flex w-full flex-col gap-2 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-accent"
>
	<div class="flex items-center gap-2">
		<BrandIcon icon={entry.icon} size={18} />
		<span class="text-sm font-semibold">{entry.preset.meta.name}</span>
	</div>
	{#if entry.preset.meta.description}
		<p class="text-xs text-muted-foreground">{entry.preset.meta.description}</p>
	{/if}
	{#if tags.length}
		<div class="flex flex-wrap gap-1">
			{#each tags as tag (tag)}
				<span class="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">{tag}</span
				>
			{/each}
		</div>
	{/if}
</button>
