import type { ArchNode } from '$lib/registry/types';
import type { Snapshot } from '$lib/persistence/migrate';

/** Layered layout spacing (px), echoing the convert-to-microservices geometry. */
const COL = 240;
const ROW = 130;

function hasPosition(n: ArchNode): boolean {
	return !!n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y);
}

/**
 * Deterministic layered fallback layout. Top-level nodes are assigned a column
 * by their longest-path depth from the sources (left → right) and stacked within
 * the column. Nodes that already have a position are kept as anchors; replicas
 * (with a `parentId`) are left to the pool. Only nodes missing a position are
 * moved, so a fully-positioned preset is returned untouched.
 */
export function autoLayout(snapshot: Snapshot): Snapshot {
	const tops = snapshot.nodes.filter((n) => !n.parentId);
	const missing = tops.filter((n) => !hasPosition(n));
	if (!missing.length) return snapshot;

	const ids = new Set(tops.map((n) => n.id));
	const adj = new Map<string, string[]>(tops.map((n) => [n.id, []]));
	const indeg = new Map<string, number>(tops.map((n) => [n.id, 0]));
	for (const e of snapshot.edges) {
		if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
		adj.get(e.source)!.push(e.target);
		indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
	}

	// Longest-path layering via Kahn's algorithm.
	const level = new Map<string, number>(tops.map((n) => [n.id, 0]));
	const queue = tops.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
	while (queue.length) {
		const u = queue.shift()!;
		for (const v of adj.get(u)!) {
			level.set(v, Math.max(level.get(v) ?? 0, (level.get(u) ?? 0) + 1));
			indeg.set(v, (indeg.get(v) ?? 0) - 1);
			if ((indeg.get(v) ?? 0) === 0) queue.push(v);
		}
	}

	// Place missing nodes, stacking within each column (in document order).
	const slot = new Map<number, number>();
	const moved = new Set(missing.map((n) => n.id));
	const nodes = snapshot.nodes.map((n) => {
		if (!moved.has(n.id)) return n;
		const lvl = level.get(n.id) ?? 0;
		const row = slot.get(lvl) ?? 0;
		slot.set(lvl, row + 1);
		return { ...n, position: { x: lvl * COL, y: row * ROW } };
	});

	return { version: snapshot.version, nodes, edges: snapshot.edges };
}
