import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

/** Load level buckets, by utilization (offered / capacity). */
export type Level = 'idle' | 'ok' | 'warn' | 'crit';

export type NodeStat = {
	/** req/s arriving at the node */
	offered: number;
	/** req/s actually served = min(offered, capacity) */
	served: number;
	/** null for pure sources (Carga) */
	capacity: number | null;
	/** offered / capacity, null when capacity is irrelevant */
	util: number | null;
	/** req/s dropped because offered exceeded capacity */
	dropped: number;
	level: Level;
	/** node sits on a cycle; its inputs are computed best-effort */
	cyclic?: boolean;
	/** a pool with no balancer feeding it */
	warn?: 'no-lb';
};

export type EdgeStat = {
	/** req/s flowing through the edge (the source's served output) */
	load: number;
	/** colored by the utilization of the edge's target */
	level: Level;
};

export type SimResult = {
	nodes: Record<string, NodeStat>;
	edges: Record<string, EdgeStat>;
};

/** Color thresholds: 0 idle · ≤70% ok · ≤100% warn · >100% crit. */
export function bucket(util: number): Level {
	if (!(util > 0)) return 'idle';
	if (util <= 0.7) return 'ok';
	if (util <= 1) return 'warn';
	return 'crit';
}

/** Default relative routing weight for a gateway target with no explicit weight. */
export const DEFAULT_GATEWAY_WEIGHT = 50;

export const LEVEL_STROKE: Record<Level, string> = {
	idle: '#94a3b8', // slate-400
	ok: '#22c55e', // green-500
	warn: '#f59e0b', // amber-500
	crit: '#ef4444' // red-500
};

function capacityOf(n: ArchNode): number | null {
	const d = n.data;
	if (d.kind === 'service' || d.kind === 'database' || d.kind === 'api-gateway') return d.capacity;
	if (d.kind === 'load-balancer') return d.capacity;
	if (d.kind === 'monolith') return d.capacity;
	return null;
}

/**
 * Steady-state load propagation over the diagram.
 *
 * Rules (all decided in the design phase):
 *  - Carga nodes inject `rps`.
 *  - Throttle: every node serves `min(offered, capacity)` and drops the rest.
 *  - Broadcast: a non-LB node sends its full served output down every out edge.
 *  - A pool splits its incoming load across replicas using the feeding LB's
 *    algorithm (round-robin = even; weighted/least-connections = by capacity).
 *  - Cycles are detected, their back-edges ignored, and the nodes flagged.
 *
 * `capMult` scales a node's effective capacity (default 1). Deploys drive it:
 * recreate = 0 (full downtime), rolling = (R-1)/R, blue-green = 1.
 */
export function computeSim(
	nodes: ArchNode[],
	edges: Edge[],
	capMult: Record<string, number> = {}
): SimResult {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const poolIds = new Set(nodes.filter((n) => n.data.kind === 'pool').map((n) => n.id));
	const isChild = (n: ArchNode) => !!n.parentId && poolIds.has(n.parentId);

	const childrenOf = new Map<string, ArchNode[]>();
	for (const n of nodes) {
		if (isChild(n)) {
			const list = childrenOf.get(n.parentId!) ?? [];
			list.push(n);
			childrenOf.set(n.parentId!, list);
		}
	}

	// Logical graph = everything except pool children (those live inside a pool).
	const logical = nodes.filter((n) => !isChild(n));
	const logicalIds = new Set(logical.map((n) => n.id));
	const ledges = edges.filter((e) => logicalIds.has(e.source) && logicalIds.has(e.target));

	const incoming = new Map<string, string[]>();
	const inEdges = new Map<string, Edge[]>();
	const outEdges = new Map<string, Edge[]>();
	const succ = new Map<string, string[]>();
	const indeg = new Map<string, number>();
	for (const n of logical) {
		succ.set(n.id, []);
		indeg.set(n.id, 0);
		inEdges.set(n.id, []);
		outEdges.set(n.id, []);
	}
	for (const e of ledges) {
		succ.get(e.source)!.push(e.target);
		indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
		incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]);
		inEdges.get(e.target)!.push(e);
		outEdges.get(e.source)!.push(e);
	}

	// Kahn topological order; leftovers are on cycles.
	const queue = logical.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
	const order: string[] = [];
	const seen = new Set<string>();
	while (queue.length) {
		const id = queue.shift()!;
		order.push(id);
		seen.add(id);
		for (const s of succ.get(id)!) {
			indeg.set(s, indeg.get(s)! - 1);
			if (indeg.get(s) === 0) queue.push(s);
		}
	}
	const cyclic = new Set(logical.filter((n) => !seen.has(n.id)).map((n) => n.id));
	for (const id of cyclic) order.push(id);

	const served = new Map<string, number>();
	const flow = new Map<string, number>(); // edgeId -> req/s carried by that edge
	const stat: Record<string, NodeStat> = {};

	const offeredOf = (id: string) =>
		(inEdges.get(id) ?? []).reduce((s, e) => s + (flow.get(e.id) ?? 0), 0);

	// Push a node's served output onto its out-edges. Every node *broadcasts* its
	// full output to each dependency, except an API gateway, which *routes*: it
	// splits its output across targets proportionally to their relative weights.
	const emit = (n: ArchNode, sv: number) => {
		const outs = outEdges.get(n.id) ?? [];
		if (n.data.kind === 'api-gateway') {
			const w = n.data.weights ?? {};
			const weightOf = (e: Edge) => Math.max(0, w[e.target] ?? DEFAULT_GATEWAY_WEIGHT);
			const total = outs.reduce((s, e) => s + weightOf(e), 0);
			for (const e of outs) flow.set(e.id, total > 0 ? sv * (weightOf(e) / total) : 0);
		} else {
			for (const e of outs) flow.set(e.id, sv);
		}
	};

	for (const id of order) {
		const n = byId.get(id)!;
		const kind = n.data.kind;
		const cyc = cyclic.has(id);

		if (kind === 'load') {
			const out = n.data.rps;
			served.set(id, out);
			emit(n, out);
			stat[id] = {
				offered: out,
				served: out,
				capacity: null,
				util: null,
				dropped: 0,
				level: out > 0 ? 'ok' : 'idle',
				cyclic: cyc
			};
			continue;
		}

		const offered = offeredOf(id);

		if (kind === 'pool') {
			const kids = childrenOf.get(id) ?? [];
			const pm = capMult[id] ?? 1;
			const childCap = (c: ArchNode) => capOrZero(c) * pm;
			const totalCap = kids.reduce((s, c) => s + childCap(c), 0);
			const lb = (incoming.get(id) ?? [])
				.map((s) => byId.get(s))
				.find((x) => x?.data.kind === 'load-balancer');
			const algo = lb?.data.kind === 'load-balancer' ? lb.data.algorithm : 'round-robin';

			const even = algo === 'round-robin' || totalCap === 0 || kids.length === 0;
			let poolServed = 0;
			for (const c of kids) {
				const share = even
					? kids.length
						? offered / kids.length
						: 0
					: offered * (capOrZero(c) / totalCap);
				const cc = childCap(c);
				const sv = Math.min(share, cc);
				poolServed += sv;
				stat[c.id] = {
					offered: share,
					served: sv,
					capacity: cc,
					util: cc > 0 ? share / cc : 0,
					dropped: Math.max(0, share - sv),
					level: bucket(cc > 0 ? share / cc : 0)
				};
			}
			served.set(id, poolServed);
			emit(n, poolServed);
			const util = totalCap > 0 ? offered / totalCap : 0;
			stat[id] = {
				offered,
				served: poolServed,
				capacity: totalCap,
				util,
				dropped: Math.max(0, offered - poolServed),
				level: bucket(util),
				cyclic: cyc,
				warn: lb ? undefined : 'no-lb'
			};
			continue;
		}

		// service / database / api-gateway / load-balancer / monolith
		const baseCap = capacityOf(n);
		const cap = baseCap == null ? null : baseCap * (capMult[id] ?? 1);
		const limit = cap ?? Infinity;
		const sv = Math.min(offered, limit);
		served.set(id, sv);
		emit(n, sv);
		stat[id] = {
			offered,
			served: sv,
			capacity: cap,
			util: cap == null ? null : cap > 0 ? offered / cap : offered > 0 ? Infinity : 0,
			dropped: Math.max(0, offered - sv),
			level:
				cap == null
					? offered > 0
						? 'ok'
						: 'idle'
					: bucket(cap > 0 ? offered / cap : offered > 0 ? Infinity : 0),
			cyclic: cyc
		};
	}

	const edgeStats: Record<string, EdgeStat> = {};
	for (const e of edges) {
		const load = flow.get(e.id) ?? served.get(e.source) ?? 0;
		const target = stat[e.target];
		edgeStats[e.id] = { load, level: target ? target.level : load > 0 ? 'ok' : 'idle' };
	}

	return { nodes: stat, edges: edgeStats };
}

function capOrZero(n: ArchNode): number {
	return n.data.kind === 'service' ? n.data.capacity : (capacityOf(n) ?? 0);
}
