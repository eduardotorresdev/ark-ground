import { graph } from './graph.svelte';
import type { ArchNode } from '$lib/registry/types';

/** Transient UI state around the canvas. */
class UiStore {
	selectedId = $state<string | null>(null);

	get selectedNode(): ArchNode | null {
		if (!this.selectedId) return null;
		return graph.nodes.find((n) => n.id === this.selectedId) ?? null;
	}

	select(id: string | null) {
		this.selectedId = id;
	}
}

export const ui = new UiStore();
