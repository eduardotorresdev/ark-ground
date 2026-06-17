<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Globe from '@lucide/svelte/icons/globe';
	import type { GatewayData } from '$lib/registry/types';

	let { data, selected }: NodeProps = $props();
	const d = $derived(data as GatewayData);
</script>

<div
	class="min-w-40 rounded-lg border bg-card px-3 py-2 shadow-sm"
	class:ring-2={selected}
	style="border-color: #818cf8"
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-indigo-100 p-1 text-indigo-700">
			<Globe size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">{d.routes} rota{d.routes === 1 ? '' : 's'}</div>
		</div>
	</div>
	<Handle type="source" position={Position.Right} id="out" />
</div>
