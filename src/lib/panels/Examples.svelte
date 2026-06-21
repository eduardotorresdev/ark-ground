<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import {
		CATEGORY_LABEL,
		searchPresets,
		type PresetCategory,
		type PresetEntry
	} from '$lib/presets/library';
	import PresetCard from './PresetCard.svelte';
	import AddPresetDialog from './AddPresetDialog.svelte';

	let query = $state('');
	let selected = $state<PresetEntry | null>(null);

	const ORDER: PresetCategory[] = ['monoliths', 'microservices'];

	const sections = $derived.by(() => {
		const results = searchPresets(query);
		return ORDER.map((category) => ({
			category,
			label: CATEGORY_LABEL[category],
			entries: results.filter((e) => e.category === category)
		})).filter((s) => s.entries.length > 0);
	});
</script>

<div class="flex flex-col gap-4">
	<Input placeholder="Buscar exemplos…" bind:value={query} />

	{#if sections.length === 0}
		<p class="text-xs text-muted-foreground">Nenhum exemplo encontrado.</p>
	{/if}

	{#each sections as section (section.category)}
		<div class="flex flex-col gap-2">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{section.label}
			</span>
			{#each section.entries as entry (entry.preset.meta.id)}
				<PresetCard {entry} onpick={() => (selected = entry)} />
			{/each}
		</div>
	{/each}
</div>

<AddPresetDialog entry={selected} onClose={() => (selected = null)} />
