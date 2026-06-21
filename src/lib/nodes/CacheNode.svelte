<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import DatabaseZap from '@lucide/svelte/icons/database-zap';
	import type { CacheData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as CacheData);
	const level = $derived(sim.level(id));
	const stat = $derived(sim.nodeStat(id));
	const cache = $derived(sim.cacheStat(id));
	const warmth = $derived(cache?.warmth ?? (d.ttlSeconds > 0 ? 0 : 1));
	const warmthPct = $derived(Math.round(warmth * 100));

	/** Health story to present: cold / warming / healthy / overloaded. */
	const health = $derived.by(() => {
		if ((stat?.util ?? 0) > 1) return { label: 'sobrecarregado', color: LEVEL_STROKE.crit };
		if (warmth >= 0.85) return { label: 'saudável', color: LEVEL_STROKE.ok };
		if (warmth >= 0.15) return { label: 'aquecendo', color: LEVEL_STROKE.warn };
		return { label: 'frio', color: LEVEL_STROKE.idle };
	});
</script>

<div
	class="min-w-44 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-colors"
	class:ring-2={selected}
	style:border-color={LEVEL_STROKE[level]}
>
	<Handle type="target" position={Position.Left} id="in" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-cyan-100 p-1 text-cyan-700">
			<DatabaseZap size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground tabular-nums">
				{d.capacity} rps · {Math.round(d.hitRatio * 100)}% hit{d.ttlSeconds > 0
					? ` · TTL ${d.ttlSeconds}s`
					: ''}
			</div>
		</div>
	</div>

	<Metric {id} />

	{#if cache}
		<div
			class="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold tabular-nums text-muted-foreground"
		>
			<span style:color={LEVEL_STROKE.ok}>✓ {Math.round(cache.hits)} hit/s</span>
			<span>↦ {Math.round(cache.misses)} miss/s</span>
		</div>
		{#if d.ttlSeconds > 0}
			<!-- warmth bar: the temporal hit-ratio modulation -->
			<div class="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
				<div
					class="h-full transition-[width]"
					style:width="{warmthPct}%"
					style:background-color={health.color}
				></div>
			</div>
			<div
				class="mt-0.5 flex items-center justify-between text-[10px] font-semibold tabular-nums"
				style:color={health.color}
			>
				<span>{health.label}</span>
				<span>{warmthPct}% · {Math.round(cache.hitRatio * 100)}% hit ef.</span>
			</div>
		{/if}
	{/if}
	<Handle type="source" position={Position.Right} id="out" />
</div>
