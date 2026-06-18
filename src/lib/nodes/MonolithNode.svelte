<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Boxes from '@lucide/svelte/icons/boxes';
	import type { MonolithData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';
	import DeployBadge from './DeployBadge.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as MonolithData);
	const level = $derived(sim.level(id));
</script>

<div
	class="min-w-44 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-fuchsia-100 p-1 text-fuchsia-700">
			<Boxes size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.capacity} rps · {d.modules.length} módulo{d.modules.length === 1 ? '' : 's'}
			</div>
		</div>
	</div>

	{#if d.modules.length}
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
	<DeployBadge {id} version={d.version} />
	<Handle type="source" position={Position.Right} id="out" />
</div>
