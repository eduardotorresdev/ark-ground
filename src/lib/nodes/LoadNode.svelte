<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Zap from '@lucide/svelte/icons/zap';
	import type { LoadData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as LoadData);
	const disp = $derived(sim.dispOf(id));
</script>

<div
	class="min-w-36 rounded-lg border-2 border-violet-400 bg-violet-50 px-3 py-2 shadow-sm"
	class:ring-2={selected}
>
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-violet-100 p-1 text-violet-700">
			<Zap size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium text-violet-900">{d.label}</div>
			<div class="text-xs font-semibold text-violet-700 tabular-nums">
				→ {Math.round(disp.served)} rps
			</div>
		</div>
	</div>
	<Handle type="source" position={Position.Right} id="out" />
</div>
