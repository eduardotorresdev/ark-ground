<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { graph } from '$lib/stores/graph.svelte';
	import { sim } from '$lib/stores/sim.svelte';
	import { deploy } from '$lib/stores/deploy.svelte';
	import { detectQuanta } from '$lib/sim/quanta';

	const runs = $derived(Object.values(deploy.runs));

	// Total injected traffic = sum of every load node's rps.
	const totalOffered = $derived(
		graph.nodes.reduce((s, n) => s + (n.data.kind === 'load' ? n.data.rps : 0), 0)
	);
	// Total dropped right now across the whole diagram.
	const totalDropped = $derived(
		Object.values(sim.result.nodes).reduce((s, st) => s + st.dropped, 0)
	);
	const pctDropped = $derived(totalOffered > 0 ? Math.round((totalDropped / totalOffered) * 100) : 0);

	const quanta = $derived(detectQuanta(graph.nodes, graph.edges));
	const deployingIds = $derived(new Set(runs.map((r) => r.nodeId)));
	const affected = $derived(
		quanta.filter((q) => q.nodeIds.some((id) => deployingIds.has(id))).length
	);

	const remainingSec = $derived(
		runs.length
			? (Math.max(...runs.map((r) => r.durationMs - (sim.now - r.startMs))) / 1000).toFixed(1)
			: '0'
	);
</script>

{#if runs.length}
	<div
		class="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur"
	>
		<div class="flex items-center gap-2 font-semibold">
			<TriangleAlert size={14} class={pctDropped > 0 ? 'text-red-600' : 'text-amber-500'} />
			Deploy em andamento · {remainingSec}s restantes
		</div>
		<div class="mt-1 flex items-center gap-4 tabular-nums text-muted-foreground">
			<span>
				<span class="font-semibold" class:text-red-600={pctDropped > 0}>{pctDropped}%</span> do tráfego
				dropado
			</span>
			<span>quanta afetados: {affected}/{quanta.length || 0}</span>
		</div>
	</div>
{/if}
