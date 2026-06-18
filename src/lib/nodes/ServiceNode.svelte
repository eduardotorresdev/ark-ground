<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Server from '@lucide/svelte/icons/server';
	import Copy from '@lucide/svelte/icons/copy';
	import type { ServiceData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';
	import DeployBadge from './DeployBadge.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as ServiceData);
	const level = $derived(sim.level(id));
	const isSelected = $derived(ui.selectedId === id);
	// A replica living inside a pool: laid out by the pool, no own chrome.
	const isReplica = $derived(!!graph.nodes.find((n) => n.id === id)?.parentId);

	function duplicate() {
		const created = graph.duplicateService(id);
		if (created) ui.select(created);
	}
</script>

<div
	class="relative w-full rounded-lg border-2 bg-card px-3 py-2 transition-colors"
	class:min-w-40={!isReplica}
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
				title="Duplicar (⌘/Ctrl + D)"
				aria-label="Duplicar serviço"
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
		<span class="rounded-md bg-emerald-100 p-1 text-emerald-700">
			<Server size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.capacity} rps{d.language ? ` · ${d.language}` : ''}
			</div>
		</div>
	</div>
	<Metric {id} />
	{#if !isReplica}
		<DeployBadge {id} version={d.version} />
		<Handle type="source" position={Position.Right} id="out" />
	{/if}
</div>
