<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		useSvelteFlow,
		type Connection,
		type Edge
	} from '@xyflow/svelte';
	import { nodeTypes } from './nodeTypes';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { canConnect } from '$lib/registry';
	import { DND_MIME } from '$lib/canvas/dnd';
	import type { NodeKind } from '$lib/registry/types';

	const { screenToFlowPosition } = useSvelteFlow();

	function onDrop(event: DragEvent) {
		event.preventDefault();
		const kind = event.dataTransfer?.getData(DND_MIME) as NodeKind | undefined;
		if (!kind) return;
		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		const id = graph.addNode(kind, position);
		ui.select(id);
	}

	function isValid(connection: Connection | Edge): boolean {
		const src = graph.nodes.find((n) => n.id === connection.source)?.data.kind;
		const dst = graph.nodes.find((n) => n.id === connection.target)?.data.kind;
		return !!src && !!dst && canConnect(src, dst);
	}
</script>

<div
	class="h-full w-full"
	role="application"
	ondragover={(e) => e.preventDefault()}
	ondrop={onDrop}
>
	<SvelteFlow
		bind:nodes={graph.nodes}
		bind:edges={graph.edges}
		{nodeTypes}
		fitView
		isValidConnection={isValid}
		onconnect={(c) => graph.connect(c)}
		onnodeclick={({ node }) => ui.select(node.id)}
		onpaneclick={() => ui.select(null)}
	>
		<Background />
		<Controls />
		<MiniMap />
	</SvelteFlow>
</div>
