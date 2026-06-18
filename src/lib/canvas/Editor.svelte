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
	import { edgeTypes } from './edgeTypes';
	import QuantaOverlay from './QuantaOverlay.svelte';
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

	function isEditing(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
	}

	function onKeydown(event: KeyboardEvent) {
		if (isEditing(event.target)) return;

		// ⌘/Ctrl + D → duplicate the selected service.
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
			const node = ui.selectedNode;
			if (node?.data.kind === 'service') {
				event.preventDefault();
				const created = graph.duplicateService(node.id);
				if (created) ui.select(created);
			}
			return;
		}

		// Delete / Backspace → remove the selected edge or node.
		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (ui.selectedEdgeId) {
				event.preventDefault();
				graph.removeEdge(ui.selectedEdgeId);
				ui.clear();
			} else if (ui.selectedId) {
				event.preventDefault();
				graph.removeNode(ui.selectedId);
				ui.clear();
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

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
		{edgeTypes}
		defaultEdgeOptions={{ type: 'load' }}
		deleteKey={null}
		fitView
		isValidConnection={isValid}
		onconnect={(c) => graph.connect(c)}
		onnodeclick={({ node }) => ui.select(node.id)}
		onedgeclick={({ edge }) => ui.selectEdge(edge.id)}
		onpaneclick={() => ui.clear()}
	>
		<QuantaOverlay />
		<Background />
		<Controls />
		<MiniMap />
	</SvelteFlow>
</div>
