<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Split from '@lucide/svelte/icons/split';
	import type { LoadBalancerData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';

	const ALGO_LABEL: Record<LoadBalancerData['algorithm'], string> = {
		'round-robin': 'round-robin',
		weighted: 'weighted',
		'least-connections': 'least-conn'
	};

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as LoadBalancerData);
	const disp = $derived(sim.dispOf(id));
	const level = $derived(sim.level(id));
</script>

<div
	class="min-w-36 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-sky-100 p-1 text-sky-700">
			<Split size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground tabular-nums">
				{ALGO_LABEL[d.algorithm]} · {Math.round(disp.served)} rps
			</div>
		</div>
	</div>
	<Handle type="source" position={Position.Right} id="out" />
</div>
