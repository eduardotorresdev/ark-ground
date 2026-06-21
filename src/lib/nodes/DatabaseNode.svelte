<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Database from '@lucide/svelte/icons/database';
	import type { DatabaseData } from '$lib/registry/types';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import Metric from './Metric.svelte';

	/** Max per-unit bars to render before summarizing the rest. */
	const MAX_BARS = 8;

	let { id, data, selected }: NodeProps = $props();
	const d = $derived(data as DatabaseData);
	const level = $derived(sim.level(id));
	const db = $derived(sim.nodeStat(id)?.db);

	const modeLabel = $derived.by(() => {
		const m = d.mode ?? 'single';
		if (m === 'replicas') return `${d.replicaCount ?? 2}×réplica`;
		if (m === 'sharded') return `${d.shardCount ?? 2}×shard`;
		return null;
	});

	// The hot shard / write bar is always index 0, so a simple slice keeps it visible.
	const shownUnits = $derived(db ? db.units.slice(0, MAX_BARS) : []);
	const hiddenCount = $derived(db ? Math.max(0, db.units.length - MAX_BARS) : 0);

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
	<Handle type="target" position={Position.Left} id="conn" />
	<div class="flex items-center gap-2">
		<span class="rounded-md bg-amber-100 p-1 text-amber-700">
			<Database size={16} />
		</span>
		<div class="leading-tight">
			<div class="text-sm font-medium">{d.label}</div>
			<div class="text-xs text-muted-foreground">
				{d.engine}{modeLabel ? ` · ${modeLabel}` : ''} · {d.capacity} rps{d.persistent
					? ' · persistente'
					: ''}
			</div>
		</div>
	</div>
	<Metric {id} />

	{#if db && (db.mode !== 'single' || db.units.length > 1)}
		<div class="mt-2 flex flex-col gap-1">
			{#each shownUnits as u, i (i)}
				<div class="flex items-center gap-1.5">
					<span
						class="w-20 shrink-0 truncate text-[9px] text-muted-foreground"
						class:font-semibold={u.hot}
						title={u.label}
					>
						{u.label}
					</span>
					<div class="h-1.5 flex-1 overflow-hidden rounded bg-muted">
						<div
							class="h-full transition-[width]"
							style:width="{Math.min(100, Math.round(u.util * 100))}%"
							style:background-color={LEVEL_STROKE[u.level]}
						></div>
					</div>
					<span
						class="w-7 shrink-0 text-right text-[9px] font-semibold tabular-nums"
						style:color={LEVEL_STROKE[u.level]}
					>
						{Math.min(999, Math.round(u.util * 100))}%
					</span>
				</div>
			{/each}
			{#if hiddenCount > 0}
				<span class="text-[9px] text-muted-foreground">+{hiddenCount} unidades…</span>
			{/if}
		</div>
		{#if db.replicationLagSeconds && db.replicationLagSeconds > 0.05}
			<div class="mt-1 text-[10px] font-semibold tabular-nums" style:color={LEVEL_STROKE[level]}>
				lag replicação: {fmtLag(db.replicationLagSeconds)}
			</div>
		{/if}
	{/if}
</div>
