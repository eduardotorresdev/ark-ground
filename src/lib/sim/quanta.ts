import type { Edge } from '@xyflow/svelte';
import type { ArchNode } from '$lib/registry/types';

/** A detected architecture quantum: an independently deployable subgraph. */
export type Quantum = { id: string; nodeIds: string[] };

/**
 * Autodetect architecture quanta from the diagram topology.
 *
 * A quantum is a connected component of the architecture graph, treating edges
 * as undirected — every edge here is a synchronous coupling, so a shared
 * gateway/DB ties everything into one quantum and disconnected subgraphs are
 * separate quanta.
 *
 * Rules:
 * - `load` nodes (traffic generators) are not part of the architecture: they
 *   and their edges are excluded.
 * - Pool replicas live inside their pool; edges connect the pool, not the
 *   children, so children are skipped (the pool's box already encloses them).
 * - Only components containing at least one `service` or `pool` get a box;
 *   infra-only components (a lone database or gateway) are ignored.
 */
export function detectQuanta(nodes: ArchNode[], edges: Edge[]): Quantum[] {
	const poolIds = new Set(nodes.filter((n) => n.data.kind === 'pool').map((n) => n.id));
	const isChild = (n: ArchNode) => !!n.parentId && poolIds.has(n.parentId);

	// Logical nodes: drop traffic generators and pool replicas.
	const logical = nodes.filter((n) => n.data.kind !== 'load' && !isChild(n));
	const kindById = new Map(logical.map((n) => [n.id, n.data.kind]));

	// Undirected adjacency over edges whose endpoints are both logical nodes.
	const adj = new Map<string, string[]>();
	for (const n of logical) adj.set(n.id, []);
	for (const e of edges) {
		if (!adj.has(e.source) || !adj.has(e.target)) continue;
		adj.get(e.source)!.push(e.target);
		adj.get(e.target)!.push(e.source);
	}

	const visited = new Set<string>();
	const quanta: Quantum[] = [];

	for (const start of logical) {
		if (visited.has(start.id)) continue;
		const component: string[] = [];
		const stack = [start.id];
		visited.add(start.id);
		while (stack.length) {
			const id = stack.pop()!;
			component.push(id);
			for (const next of adj.get(id)!) {
				if (!visited.has(next)) {
					visited.add(next);
					stack.push(next);
				}
			}
		}

		const hasService = component.some(
			(id) => kindById.get(id) === 'service' || kindById.get(id) === 'pool'
		);
		if (!hasService) continue;

		// Stable id (smallest node id) so the box doesn't flicker across renders.
		const id = component.reduce((a, b) => (a < b ? a : b));
		quanta.push({ id, nodeIds: component });
	}

	return quanta;
}
