<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Server from '@lucide/svelte/icons/server';
	import type { ServiceData } from '$lib/registry/types';

	let { data, selected }: NodeProps = $props();
	const d = $derived(data as ServiceData);
</script>

<div
	class="min-w-40 rounded-lg border bg-card px-3 py-2 shadow-sm transition-shadow"
	class:ring-2={selected}
	style="border-color: var(--color-emerald-400, #34d399)"
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-emerald-100 p-1 text-emerald-700">
			<Server size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.replicas} réplica{d.replicas === 1 ? '' : 's'}{d.language ? ` · ${d.language}` : ''}
			</div>
		</div>
	</div>
	<Handle type="source" position={Position.Right} id="out" />
</div>
