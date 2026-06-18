import { graph } from './graph.svelte';
import type { ArchNode } from '$lib/registry/types';

/** Transient UI state around the canvas. */
class UiStore {
	/** All currently-selected node ids (canvas supports multi-select). */
	selectedIds = $state<Set<string>>(new Set());
	selectedEdgeId = $state<string | null>(null);
	/** Draw dashed boxes around autodetected architecture quanta. */
	showQuanta = $state<boolean>(true);

	toggleQuanta() {
		this.showQuanta = !this.showQuanta;
	}

	/** The single selected id, or null when zero/multiple are selected. */
	get selectedId(): string | null {
		return this.selectedIds.size === 1 ? [...this.selectedIds][0] : null;
	}

	get selectedNode(): ArchNode | null {
		const id = this.selectedId;
		return id ? (graph.nodes.find((n) => n.id === id) ?? null) : null;
	}

	get selectedNodes(): ArchNode[] {
		return graph.nodes.filter((n) => this.selectedIds.has(n.id));
	}

	/** Select a single node (clears any edge selection). */
	select(id: string | null) {
		this.selectedIds = id ? new Set([id]) : new Set();
		this.selectedEdgeId = null;
	}

	/** Mirror the canvas's full selection (clears any edge selection). */
	setSelection(ids: string[]) {
		this.selectedIds = new Set(ids);
		if (ids.length) this.selectedEdgeId = null;
	}

	/** Select an edge (clears any node selection). */
	selectEdge(id: string | null) {
		this.selectedEdgeId = id;
		this.selectedIds = new Set();
	}

	clear() {
		this.selectedIds = new Set();
		this.selectedEdgeId = null;
	}
}

export const ui = new UiStore();
