<script lang="ts">
	import { ViewportPortal, getNodesBounds, useStore } from '@xyflow/svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { detectQuanta } from '$lib/sim/quanta';

	/** Breathing room (px, flow coords) between the member nodes and the box. */
	const PAD = 24;

	const store = useStore();

	const boxes = $derived.by(() => {
		if (!ui.showQuanta) return [];
		// Reference nodeLookup so the boxes recompute once nodes are measured.
		const nodeLookup = store.nodeLookup;
		return detectQuanta(graph.nodes, graph.edges)
			.map((q) => {
				const b = getNodesBounds(q.nodeIds, { nodeLookup });
				return {
					id: q.id,
					x: b.x - PAD,
					y: b.y - PAD,
					w: b.width + PAD * 2,
					h: b.height + PAD * 2
				};
			})
			.filter((b) => b.w > 0 && b.h > 0);
	});
</script>

<ViewportPortal target="back">
	{#each boxes as b (b.id)}
		<div
			class="ark-quantum pointer-events-none absolute rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted-foreground/5"
			style="left: {b.x}px; top: {b.y}px; width: {b.w}px; height: {b.h}px;"
		></div>
	{/each}
</ViewportPortal>
