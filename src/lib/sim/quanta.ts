import type { Edge } from '@xyflow/svelte';
import type { ArchNode } from '$lib/registry/types';

/** A detected architecture quantum: an independently deployable subgraph. */
export type Quantum = { id: string; nodeIds: string[] };

/**
 * Kinds that route traffic without statically coupling what they connect. They
 * are edge infrastructure, not part of any quantum, and crucially they do NOT
 * bridge the things on either side: a load generator and an API gateway each
 * just forward requests, so the services behind them stay independently
 * deployable. Removing them from the graph is what lets sibling services fan out
 * into separate quanta instead of collapsing into one.
 */
const TRANSPARENT = new Set<ArchNode['data']['kind']>(['load', 'api-gateway']);

/**
 * Autodetect architecture quanta from the diagram topology.
 *
 * A quantum is an independently deployable unit, bounded by *static coupling*:
 * two nodes share a quantum only when they are wired together by something that
 * actually binds their lifecycles — a shared database, a synchronous service-to-
 * service call, or a load balancer in front of a pool. We model this as the
 * connected components of the graph with traffic-routing infrastructure removed.
 *
 * Rules:
 * - Traffic-routing nodes (`load`, `api-gateway`) are transparent: they and
 *   their edges are dropped, so they never tie their neighbours together. Two
 *   services behind one gateway, each with its own database, are two quanta.
 * - Static coupling still bridges: services sharing a database (or one calling
 *   another) land in the same quantum.
 * - Pool replicas live inside their pool; edges connect the pool, not the
 *   children, so children are skipped (the pool's box already encloses them).
 * - Only components containing at least one `service`, `pool`, or `monolith`
 *   get a box; infra-only components (e.g. a lone database) are ignored.
 */
export function detectQuanta(nodes: ArchNode[], edges: Edge[]): Quantum[] {
	const poolIds = new Set(nodes.filter((n) => n.data.kind === 'pool').map((n) => n.id));
	const isChild = (n: ArchNode) => !!n.parentId && poolIds.has(n.parentId);

	// Logical nodes: drop transparent routing infra and pool replicas.
	const logical = nodes.filter((n) => !TRANSPARENT.has(n.data.kind) && !isChild(n));
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

		const hasService = component.some((id) => {
			const k = kindById.get(id);
			return k === 'service' || k === 'pool' || k === 'monolith';
		});
		if (!hasService) continue;

		// Stable id (smallest node id) so the box doesn't flicker across renders.
		const id = component.reduce((a, b) => (a < b ? a : b));
		quanta.push({ id, nodeIds: component });
	}

	return quanta;
}
