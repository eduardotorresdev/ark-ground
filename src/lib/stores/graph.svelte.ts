import { addEdge, type Connection, type Edge } from '@xyflow/svelte';
import { getDef } from '$lib/registry';
import type { ArchData, ArchNode, NodeKind } from '$lib/registry/types';

// Pool layout geometry (pixels). Replicas stack vertically (flex-col); the
// wrapper grows in height with the number of children.
const CHILD_W = 168;
const CHILD_H = 84; // real rendered replica-card height (~81px) + breathing room
const GAP = 16;
const PAD = 16;
const HEADER = 98; // 3-row header (~82px) + a GAP of breathing room before row 1

function poolSize(count: number) {
	return {
		width: PAD * 2 + CHILD_W,
		height: HEADER + count * CHILD_H + Math.max(0, count - 1) * GAP + PAD
	};
}
function childPos(i: number) {
	return { x: PAD, y: HEADER + i * (CHILD_H + GAP) };
}
function sizeStyle(w: number, h: number) {
	return `width: ${w}px; height: ${h}px;`;
}

// Pool replicas are laid out by the pool: they don't move, connect, or get
// selected individually — the pool wrapper is the interactive unit.
const CHILD_FLAGS = { draggable: false, selectable: false, connectable: false } as const;

/** Single source of truth for the diagram. The canvas binds directly to it. */
class GraphStore {
	nodes = $state.raw<ArchNode[]>([]);
	edges = $state.raw<Edge[]>([]);
	#seq = 0;

	#id(kind: NodeKind) {
		return `${kind}-${++this.#seq}`;
	}

	addNode(kind: NodeKind, position: { x: number; y: number }): string {
		const def = getDef(kind);
		const id = this.#id(kind);
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
		this.edges = addEdge({ ...connection, type: 'load' }, this.edges);
	}

	removeEdge(id: string) {
		this.edges = this.edges.filter((e) => e.id !== id);
	}

	/** Number of services reachable downstream of a gateway (expanding pools). */
	serviceCount(gatewayId: string): number {
		const visited = new Set<string>();
		const stack = this.edges.filter((e) => e.source === gatewayId).map((e) => e.target);
		let count = 0;
		while (stack.length) {
			const target = stack.pop()!;
			if (visited.has(target)) continue;
			visited.add(target);
			const node = this.nodes.find((n) => n.id === target);
			if (!node) continue;
			if (node.data.kind === 'service') count++;
			else if (node.data.kind === 'pool') count += this.#childrenOf(target).length;
			for (const e of this.edges) if (e.source === target) stack.push(e.target);
		}
		return count;
	}

	removeNode(id: string) {
		const node = this.nodes.find((n) => n.id === id);
		if (node?.data.kind === 'pool') return this.#removePool(id);
		// removing a replica goes through removeReplica (handles dissolve)
		if (node?.parentId && this.#isPool(node.parentId)) return this.removeReplica(id);
		this.nodes = this.nodes.filter((n) => n.id !== id);
		this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
	}

	#isPool(id: string) {
		return this.nodes.find((n) => n.id === id)?.data.kind === 'pool';
	}

	#childrenOf(poolId: string) {
		return this.nodes.filter((n) => n.parentId === poolId);
	}

	/**
	 * Replicate a service. A standalone service becomes a 2-replica pool fronted
	 * by an auto-inserted load balancer (existing edges are rewired); a service
	 * already inside a pool just gains another sibling replica.
	 */
	duplicateService(id: string): string | null {
		const svc = this.nodes.find((n) => n.id === id);
		if (!svc || svc.data.kind !== 'service') return null;
		if (svc.parentId && this.#isPool(svc.parentId)) return this.addReplica(svc.parentId);

		const poolId = this.#id('pool');
		const lbId = this.#id('load-balancer');
		const replicaId = this.#id('service');
		const { width, height } = poolSize(2);

		const pool: ArchNode = {
			id: poolId,
			type: 'pool',
			position: { ...svc.position },
			width,
			height,
			style: sizeStyle(width, height),
			data: { kind: 'pool', label: `${svc.data.label} (pool)`, capacity: svc.data.capacity }
		};
		const child0: ArchNode = {
			...svc,
			parentId: poolId,
			extent: 'parent',
			position: childPos(0),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS
		};
		const child1: ArchNode = {
			id: replicaId,
			type: 'service',
			parentId: poolId,
			extent: 'parent',
			position: childPos(1),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS,
			data: { ...svc.data }
		};
		const lb: ArchNode = {
			id: lbId,
			type: 'load-balancer',
			position: { x: svc.position.x - 210, y: svc.position.y },
			data: { kind: 'load-balancer', ...getDef('load-balancer').create() } as ArchData
		};

		const others = this.nodes.filter((n) => n.id !== id);
		this.nodes = [...others, lb, pool, child0, child1];

		// Rewire: inbound edges now feed the LB, outbound edges leave the pool.
		const rewired = this.edges.map((e) => {
			if (e.target === id) return { ...e, target: lbId };
			if (e.source === id) return { ...e, source: poolId };
			return e;
		});
		this.edges = [
			...rewired,
			{ id: `e-${lbId}-${poolId}`, source: lbId, target: poolId, type: 'load' }
		];
		return poolId;
	}

	/** Add one more replica to an existing pool (inherits the pool's capacity). */
	addReplica(poolId: string): string | null {
		const pool = this.nodes.find((n) => n.id === poolId);
		if (pool?.data.kind !== 'pool') return null;
		const kids = this.#childrenOf(poolId);
		const template = kids[0];
		if (!template || template.data.kind !== 'service') return null;

		const replicaId = this.#id('service');
		const count = kids.length + 1;
		const { width, height } = poolSize(count);
		const replica: ArchNode = {
			id: replicaId,
			type: 'service',
			parentId: poolId,
			extent: 'parent',
			position: childPos(kids.length),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS,
			data: { ...template.data, capacity: pool.data.capacity }
		};
		this.nodes = [
			...this.nodes.map((n) =>
				n.id === poolId ? { ...n, width, height, style: sizeStyle(width, height) } : n
			),
			replica
		];
		return replicaId;
	}

	/** Set the per-replica capacity on a pool; every child inherits the value. */
	setPoolCapacity(poolId: string, capacity: number) {
		this.nodes = this.nodes.map((n) => {
			if (n.id === poolId && n.data.kind === 'pool')
				return { ...n, data: { ...n.data, capacity } };
			if (n.parentId === poolId && n.data.kind === 'service')
				return { ...n, data: { ...n.data, capacity } };
			return n;
		});
	}

	/** Remove the most recently added replica from a pool. */
	removeLastReplica(poolId: string) {
		const kids = this.#childrenOf(poolId);
		const last = kids[kids.length - 1];
		if (last) this.removeReplica(last.id);
	}

	/** Remove a replica; if only one would remain, dissolve the pool. */
	removeReplica(childId: string) {
		const child = this.nodes.find((n) => n.id === childId);
		const poolId = child?.parentId;
		if (!poolId || !this.#isPool(poolId)) return;
		const remaining = this.#childrenOf(poolId).filter((n) => n.id !== childId);

		if (remaining.length >= 2) {
			const { width, height } = poolSize(remaining.length);
			this.nodes = this.nodes
				.filter((n) => n.id !== childId)
				.map((n) => {
					if (n.id === poolId) return { ...n, width, height, style: sizeStyle(width, height) };
					const idx = remaining.findIndex((r) => r.id === n.id);
					return idx >= 0 ? { ...n, position: childPos(idx) } : n;
				});
			return;
		}
		this.#dissolvePool(poolId, childId);
	}

	/** Promote the surviving replica to a standalone service, drop pool + LB. */
	#dissolvePool(poolId: string, removeChildId?: string) {
		const pool = this.nodes.find((n) => n.id === poolId);
		if (!pool) return;
		const survivor = this.#childrenOf(poolId).find((n) => n.id !== removeChildId);
		const lbEdge = this.edges.find(
			(e) =>
				e.target === poolId &&
				this.nodes.find((n) => n.id === e.source)?.data.kind === 'load-balancer'
		);
		const lbId = lbEdge?.source;

		if (survivor) {
			const promoted: ArchNode = {
				...survivor,
				parentId: undefined,
				extent: undefined,
				draggable: true,
				selectable: true,
				connectable: true,
				position: {
					x: pool.position.x + survivor.position.x,
					y: pool.position.y + survivor.position.y
				}
			};
			this.edges = this.edges
				.map((e) => {
					if (lbId && e.target === lbId) return { ...e, target: survivor.id };
					if (e.source === poolId) return { ...e, source: survivor.id };
					return e;
				})
				.filter(
					(e) =>
						e.source !== poolId && e.target !== poolId && e.source !== lbId && e.target !== lbId
				);
			this.nodes = this.nodes
				.filter(
					(n) => n.id !== poolId && n.id !== removeChildId && n.id !== lbId && n.id !== survivor.id
				)
				.concat(promoted);
		} else {
			this.#removePool(poolId);
		}
	}

	#removePool(poolId: string) {
		const childIds = new Set(this.#childrenOf(poolId).map((n) => n.id));
		const lbEdge = this.edges.find(
			(e) =>
				e.target === poolId &&
				this.nodes.find((n) => n.id === e.source)?.data.kind === 'load-balancer'
		);
		const lbId = lbEdge?.source;
		this.nodes = this.nodes.filter((n) => n.id !== poolId && !childIds.has(n.id) && n.id !== lbId);
		this.edges = this.edges.filter(
			(e) => e.source !== poolId && e.target !== poolId && e.source !== lbId && e.target !== lbId
		);
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
		this.#normalizePools();
	}

	/**
	 * Re-lay every pool's replicas: fixed vertical stack, non-interactive, and
	 * inheriting the pool's capacity. Repairs diagrams saved before replicas
	 * became fixed (overlapping positions, divergent capacities, stale sizes).
	 */
	#normalizePools() {
		const pools = this.nodes.filter((n) => n.data.kind === 'pool');
		if (!pools.length) return;
		let nodes = this.nodes;
		for (const pool of pools) {
			if (pool.data.kind !== 'pool') continue;
			const cap = pool.data.capacity;
			const kids = nodes.filter((n) => n.parentId === pool.id);
			const { width, height } = poolSize(kids.length);
			nodes = nodes.map((n) => {
				if (n.id === pool.id) return { ...n, width, height, style: sizeStyle(width, height) };
				const idx = kids.findIndex((k) => k.id === n.id);
				if (idx < 0) return n;
				return {
					...n,
					position: childPos(idx),
					width: CHILD_W,
					style: `width: ${CHILD_W}px;`,
					extent: 'parent' as const,
					...CHILD_FLAGS,
					data: n.data.kind === 'service' ? { ...n.data, capacity: cap } : n.data
				};
			});
		}
		this.nodes = nodes;
	}
}

export const graph = new GraphStore();
