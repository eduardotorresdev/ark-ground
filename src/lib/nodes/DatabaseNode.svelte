<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Database from '@lucide/svelte/icons/database';
	import type { DatabaseData } from '$lib/registry/types';

	let { data, selected }: NodeProps = $props();
	const d = $derived(data as DatabaseData);
</script>

<div
	class="min-w-40 rounded-lg border bg-card px-3 py-2 shadow-sm"
	class:ring-2={selected}
	style="border-color: #fbbf24"
>
	<Handle type="target" position={Position.Left} id="conn" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-amber-100 p-1 text-amber-700">
			<Database size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.engine}{d.persistent ? ' · persistente' : ''}
			</div>
		</div>
	</div>
</div>
