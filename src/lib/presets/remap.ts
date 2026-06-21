import type { Edge } from '@xyflow/svelte';
import type { ArchNode, NodeKind } from '$lib/registry/types';
import type { Snapshot } from '$lib/persistence/migrate';

/** Fallback node footprint (px) for kinds that carry no explicit width/height. */
const DEFAULT_W = 180;
const DEFAULT_H = 80;

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Visual bounding box of top-level nodes (replicas with a `parentId` have
 * positions relative to their pool and are excluded). Uses each node's
 * width/height when present, falling back to a default footprint.
 */
export function boundsOf(nodes: ArchNode[]): Bounds | null {
	const tops = nodes.filter((n) => !n.parentId);
	if (!tops.length) return null;
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const n of tops) {
		const w = n.width ?? DEFAULT_W;
		const h = n.height ?? DEFAULT_H;
		minX = Math.min(minX, n.position.x);
		minY = Math.min(minY, n.position.y);
		maxX = Math.max(maxX, n.position.x + w);
		maxY = Math.max(maxY, n.position.y + h);
	}
	return { minX, minY, maxX, maxY };
}

/**
 * Shift every top-level node by (dx, dy). Replicas keep their pool-relative
 * positions untouched (the pool wrapper carries them).
 */
export function offsetPositions(nodes: ArchNode[], dx: number, dy: number): ArchNode[] {
	if (dx === 0 && dy === 0) return nodes;
	return nodes.map((n) =>
		n.parentId ? n : { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
	);
}

/**
 * Rewrite every node id to a fresh one (via `nextId`), keeping all references
 * consistent: edge source/target/id, node `parentId`, and the keys of a
 * gateway's `weights` map (which are downstream node ids). Returns the rewritten
 * snapshot and the old→new id map.
 */
export function remapIds(
	snapshot: Snapshot,
	nextId: (kind: NodeKind) => string
): { snapshot: Snapshot; idMap: Map<string, string> } {
	const idMap = new Map<string, string>();
	for (const n of snapshot.nodes) {
		idMap.set(n.id, nextId(n.data.kind));
	}
	const map = (id: string) => idMap.get(id) ?? id;

	const nodes: ArchNode[] = snapshot.nodes.map((n) => {
		const next: ArchNode = { ...n, id: map(n.id) };
		if (n.parentId) next.parentId = map(n.parentId);
		if (n.data.kind === 'api-gateway' && n.data.weights) {
			const weights: Record<string, number> = {};
			for (const [target, w] of Object.entries(n.data.weights)) weights[map(target)] = w;
			next.data = { ...n.data, weights };
		}
		return next;
	});

	const edges: Edge[] = snapshot.edges.map((e) => {
		const source = map(e.source);
		const target = map(e.target);
		return { ...e, source, target, id: `${source}->${target}` };
	});

	return { snapshot: { version: snapshot.version, nodes, edges }, idMap };
}
