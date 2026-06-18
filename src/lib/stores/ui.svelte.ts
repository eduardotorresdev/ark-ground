import { graph } from './graph.svelte';
import type { ArchNode } from '$lib/registry/types';

/** Transient UI state around the canvas. */
class UiStore {
	selectedId = $state<string | null>(null);
	selectedEdgeId = $state<string | null>(null);
	/** Draw dashed boxes around autodetected architecture quanta. */
	showQuanta = $state<boolean>(true);

	toggleQuanta() {
		this.showQuanta = !this.showQuanta;
	}

	get selectedNode(): ArchNode | null {
		if (!this.selectedId) return null;
		return graph.nodes.find((n) => n.id === this.selectedId) ?? null;
	}

	/** Select a node (clears any edge selection). */
	select(id: string | null) {
		this.selectedId = id;
		this.selectedEdgeId = null;
	}

	/** Select an edge (clears any node selection). */
	selectEdge(id: string | null) {
		this.selectedEdgeId = id;
		this.selectedId = null;
	}

	clear() {
		this.selectedId = null;
		this.selectedEdgeId = null;
	}
}

export const ui = new UiStore();
