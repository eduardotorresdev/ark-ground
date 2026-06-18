import { graph } from '$lib/stores/graph.svelte';
import { CURRENT_VERSION, migrate, type AnySnapshot, type Snapshot } from './migrate';

const KEY = 'ark-ground:diagram:v1';

export function serialize(): Snapshot {
	return { version: CURRENT_VERSION, nodes: graph.nodes, edges: graph.edges };
}

function loadRaw(raw: AnySnapshot) {
	const snap = migrate(raw);
	graph.load({ nodes: snap.nodes, edges: snap.edges });
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
	loadRaw(JSON.parse(await file.text()) as AnySnapshot);
}

/**
 * Loads any saved diagram (migrating if needed), then wires a debounced
 * autosave to localStorage. Returns a cleanup function. Call once on mount.
 */
export function startAutosave(): () => void {
	const saved = localStorage.getItem(KEY);
	if (saved) {
		try {
			loadRaw(JSON.parse(saved) as AnySnapshot);
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
