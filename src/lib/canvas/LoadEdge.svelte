<script lang="ts">
	import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';

	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		markerEnd,
		selected
	}: EdgeProps = $props();

	const path = $derived(
		getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0]
	);
	const stat = $derived(sim.edgeStat(id));
	const color = $derived(LEVEL_STROKE[stat?.level ?? 'idle']);
	const flowing = $derived((stat?.load ?? 0) > 0.5);
</script>

<BaseEdge
	{id}
	{path}
	{markerEnd}
	style={`stroke:${color};stroke-width:${selected ? 4 : 2.5};${
		selected ? 'filter:drop-shadow(0 0 2px rgba(0,0,0,0.35));' : ''
	}${flowing ? 'stroke-dasharray:6;animation:ark-dash 0.6s linear infinite;' : ''}`}
/>
