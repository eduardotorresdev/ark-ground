<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Layers from '@lucide/svelte/icons/layers';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { PoolData } from '$lib/registry/types';
	import { graph } from '$lib/stores/graph.svelte';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';
	import DeployBadge from './DeployBadge.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as PoolData);
	const level = $derived(sim.level(id));
	const stat = $derived(sim.nodeStat(id));
	const count = $derived(graph.nodes.filter((n) => n.parentId === id).length);
</script>

<div
	class="h-full w-full rounded-xl border-2 bg-muted/40 transition-colors"
	class:ring-2={selected}
	class:ring-offset-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />

	<header
		class="flex flex-col gap-0.5 border-b px-3 pb-1.5 pt-2"
		style:border-color={LEVEL_STROKE[level]}
	>
		<div class="flex items-center gap-2">
			<span class="rounded-md bg-slate-200 p-1 text-slate-700">
				<Layers size={14} />
			</span>
			<div class="truncate text-sm font-semibold">{d.label}</div>
			{#if stat?.warn === 'no-lb'}
				<span class="ml-auto" title="Pool sem balanceador">
					<TriangleAlert size={14} class="text-red-600" />
				</span>
			{/if}
		</div>
		<div class="text-xs text-muted-foreground">{count} réplica{count === 1 ? '' : 's'}</div>
		<Metric {id} />
		<DeployBadge {id} version={d.version} />
	</header>

	<Handle type="source" position={Position.Right} id="out" />
</div>
