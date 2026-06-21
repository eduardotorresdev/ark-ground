<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Inbox from '@lucide/svelte/icons/inbox';
	import type { BrokerData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';

	const MODE_LABEL: Record<BrokerData['mode'], string> = {
		topic: 'tópico',
		'work-queue': 'fila'
	};

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as BrokerData);
	const level = $derived(sim.level(id));
	const disp = $derived(sim.dispOf(id));
	const broker = $derived(sim.nodeStat(id)?.broker);
	const fillPct = $derived(broker ? Math.round(broker.fill * 100) : 0);

	function fmtLag(s: number): string {
		if (!(s > 0)) return '0s';
		if (!Number.isFinite(s)) return '∞';
		return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
	}
</script>

<div
	class="min-w-44 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-teal-100 p-1 text-teal-700">
			<Inbox size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground tabular-nums">
				{MODE_LABEL[d.mode]} · {Math.round(disp.served)} rps
			</div>
		</div>
	</div>

	{#if broker}
		<!-- buffer fill bar -->
		<div class="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
			<div
				class="h-full transition-[width]"
				style:width="{fillPct}%"
				style:background-color={LEVEL_STROKE[level]}
			></div>
		</div>
		<div
			class="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold tabular-nums"
			style:color={LEVEL_STROKE[level]}
		>
			<span>{fillPct}% · {Math.round(broker.backlog).toLocaleString('pt-BR')} msg</span>
			<span>lag {fmtLag(broker.lagSeconds)}</span>
		</div>
		{#if broker.dropped > 0.5}
			<div class="mt-0.5 text-[10px] font-semibold tabular-nums" style:color={LEVEL_STROKE.crit}>
				−{Math.round(broker.dropped)} rps descartados
			</div>
		{:else if broker.blocked > 0.5}
			<div class="mt-0.5 text-[10px] font-semibold tabular-nums" style:color={LEVEL_STROKE.crit}>
				backpressure −{Math.round(broker.blocked)} rps
			</div>
		{/if}
	{/if}
	<Handle type="source" position={Position.Right} id="out" />
</div>
