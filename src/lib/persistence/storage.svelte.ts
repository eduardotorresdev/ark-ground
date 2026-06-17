import { graph } from '$lib/stores/graph.svelte';
import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

const KEY = 'ark-ground:diagram:v1';

export type Snapshot = {
	v: 1;
	nodes: ArchNode[];
	edges: Edge[];
};

export function serialize(): Snapshot {
	return { v: 1, nodes: graph.nodes, edges: graph.edges };
}

export function download() {
	const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'arquitetura.json';
	a.click();
	URL.revokeObjectURL(url);
}

export async function importFile(file: File) {
	const snap = JSON.parse(await file.text()) as Snapshot;
	graph.load({ nodes: snap.nodes, edges: snap.edges });
}

/**
 * Loads any saved diagram, then wires a debounced autosave to localStorage.
 * Returns a cleanup function. Call once on client mount.
 */
export function startAutosave(): () => void {
	const saved = localStorage.getItem(KEY);
	if (saved) {
		try {
			graph.load(JSON.parse(saved) as Snapshot);
		} catch {
			localStorage.removeItem(KEY);
		}
	}

	let timer: ReturnType<typeof setTimeout>;
	const cleanup = $effect.root(() => {
		$effect(() => {
			const payload = JSON.stringify(serialize());
			clearTimeout(timer);
			timer = setTimeout(() => localStorage.setItem(KEY, payload), 400);
		});
	});

	return () => {
		clearTimeout(timer);
		cleanup();
	};
}
