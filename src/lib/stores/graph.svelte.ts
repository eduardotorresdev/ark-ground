import { addEdge, type Connection, type Edge } from '@xyflow/svelte';
import { getDef } from '$lib/registry';
import type { ArchData, ArchNode, NodeKind } from '$lib/registry/types';

/** Single source of truth for the diagram. The canvas binds directly to it. */
class GraphStore {
	nodes = $state.raw<ArchNode[]>([]);
	edges = $state.raw<Edge[]>([]);
	#seq = 0;

	addNode(kind: NodeKind, position: { x: number; y: number }): string {
		const def = getDef(kind);
		const id = `${kind}-${++this.#seq}`;
		const data = { kind, ...def.create() } as ArchData;
		this.nodes = [...this.nodes, { id, type: kind, position, data }];
		return id;
	}

	updateData(id: string, patch: Partial<ArchData>) {
		this.nodes = this.nodes.map((n) =>
			n.id === id ? { ...n, data: { ...n.data, ...patch } as ArchData } : n
		);
	}

	connect(connection: Connection) {
		this.edges = addEdge(connection, this.edges);
	}

	removeNode(id: string) {
		this.nodes = this.nodes.filter((n) => n.id !== id);
		this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
	}

	reset() {
		this.nodes = [];
		this.edges = [];
		this.#seq = 0;
	}

	load(snapshot: { nodes: ArchNode[]; edges: Edge[] }) {
		this.nodes = snapshot.nodes ?? [];
		this.edges = snapshot.edges ?? [];
		// keep the id counter ahead of any loaded ids
		for (const n of this.nodes) {
			const m = /-(\d+)$/.exec(n.id);
			if (m) this.#seq = Math.max(this.#seq, Number(m[1]));
		}
	}
}

export const graph = new GraphStore();
