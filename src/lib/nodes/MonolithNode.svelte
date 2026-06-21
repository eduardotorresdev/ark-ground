<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Boxes from '@lucide/svelte/icons/boxes';
	import Copy from '@lucide/svelte/icons/copy';
	import type { MonolithData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import { languageOption } from '$lib/registry/icons';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import Metric from './Metric.svelte';
	import DeployBadge from './DeployBadge.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as MonolithData);
	const lang = $derived(languageOption(d.language));
	const level = $derived(sim.level(id));
	const isSelected = $derived(ui.selectedId === id);
	// A replica living inside a pool: laid out by the pool, no own chrome.
	const isReplica = $derived(!!graph.nodes.find((n) => n.id === id)?.parentId);

	function duplicate() {
		const created = graph.duplicateMonolith(id);
		if (created) ui.select(created);
	}
</script>

<div
	class="relative w-full rounded-lg border-2 bg-card px-3 py-2 transition-colors"
	class:min-w-44={!isReplica}
	class:shadow-sm={!isReplica}
	class:ring-2={(selected || isSelected) && !isReplica}
	style:border-color={LEVEL_STROKE[level]}
>
	{#if isSelected && !isReplica}
		<div
			class="nodrag absolute -top-9 right-0 flex items-center gap-1 rounded-md border bg-popover p-1 shadow-md"
		>
			<button
				type="button"
				title="Duplicar (criar pool)"
				aria-label="Duplicar monolito"
				class="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
				onclick={duplicate}
			>
				<Copy size={14} />
			</button>
		</div>
	{/if}
	{#if !isReplica}
		<Handle type="target" position={Position.Left} id="in" />
	{/if}
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-fuchsia-100 p-1 text-fuchsia-700">
			<Boxes size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="flex items-center gap-1 text-xs text-muted-foreground">
				{#if lang}
					<BrandIcon icon={lang.icon} size={12} />
					<span>{lang.label}</span>
					<span>·</span>
				{/if}
				<span>{d.capacity} rps · {d.modules.length} módulo{d.modules.length === 1 ? '' : 's'}</span>
			</div>
		</div>
	</div>

	{#if d.modules.length && !isReplica}
		<div class="mt-2 flex flex-col gap-0.5 rounded-md border border-dashed p-1.5">
			{#each d.modules as m (m.id)}
				<div class="flex items-center gap-1.5 text-[11px] text-foreground/80">
					<span class="size-1.5 rounded-full bg-fuchsia-400"></span>
					{m.label}
				</div>
			{/each}
		</div>
	{/if}

	<Metric {id} />
	{#if !isReplica}
		<DeployBadge {id} version={d.version} />
		<Handle type="source" position={Position.Right} id="out" />
	{/if}
</div>
