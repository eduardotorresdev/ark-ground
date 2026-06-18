<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Globe from '@lucide/svelte/icons/globe';
	import type { GatewayData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as GatewayData);
	const level = $derived(sim.level(id));
	const services = $derived(graph.serviceCount(id));
</script>

<div
	class="min-w-40 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-indigo-100 p-1 text-indigo-700">
			<Globe size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.capacity} rps · {services} serviço{services === 1 ? '' : 's'}
			</div>
		</div>
	</div>
	<Metric {id} />
	<Handle type="source" position={Position.Right} id="out" />
</div>
