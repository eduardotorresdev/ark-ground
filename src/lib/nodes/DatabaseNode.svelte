<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Database from '@lucide/svelte/icons/database';
	import type { DatabaseData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as DatabaseData);
	const level = $derived(sim.level(id));
</script>

<div
	class="min-w-40 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="conn" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-amber-100 p-1 text-amber-700">
			<Database size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.engine} · {d.capacity} rps{d.persistent ? ' · persistente' : ''}
			</div>
		</div>
	</div>
	<Metric {id} />
</div>
