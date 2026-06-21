import { addEdge, type Connection, type Edge } from '@xyflow/svelte';
import { getDef } from '$lib/registry';
import type { ArchData, ArchNode, NodeKind } from '$lib/registry/types';
import { remapIds, boundsOf, offsetPositions } from '$lib/presets/remap';

// Pool layout geometry (pixels). Replicas stack vertically (flex-col); the
// wrapper grows in height with the number of children.
const CHILD_W = 168;
const CHILD_H = 84; // real rendered replica-card height (~81px) + breathing room
const GAP = 16;
const PAD = 16;
// Horizontal gap inserted between the existing graph and a merged-in preset.
const MERGE_GAP = 120;
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

	/** Patch an edge's data (e.g. the call-amplification factor of a sync edge). */
	updateEdgeData(id: string, patch: Record<string, unknown>) {
		this.edges = this.edges.map((e) =>
			e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e
		);
	}

	/** Number of services reachable downstream of a gateway (expanding pools). */
	serviceCount(gatewayId: string): number {
		// Local traversal set, not reactive state — SvelteSet would be inappropriate.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
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
		return this.#poolify(svc);
	}

	/**
	 * Replicate a monolith. Mirrors {@link duplicateService}: a standalone
	 * monolith becomes a 2-replica pool behind a load balancer (every replica is
	 * an identical copy, modules included); one already in a pool gains a sibling.
	 */
	duplicateMonolith(id: string): string | null {
		const mono = this.nodes.find((n) => n.id === id);
		if (!mono || mono.data.kind !== 'monolith') return null;
		if (mono.parentId && this.#isPool(mono.parentId)) return this.addReplica(mono.parentId);
		return this.#poolify(mono);
	}

	/**
	 * Wrap a standalone service/monolith into a 2-replica pool fronted by a new
	 * load balancer. The original node becomes replica 0; a clone becomes replica
	 * 1. Inbound edges are rewired to the LB, outbound edges leave the pool.
	 */
	#poolify(node: ArchNode): string {
		const data = node.data;
		if (data.kind !== 'service' && data.kind !== 'monolith') return node.id;
		const kind = data.kind;
		const poolId = this.#id('pool');
		const lbId = this.#id('load-balancer');
		const replicaId = this.#id(kind);
		const { width, height } = poolSize(2);

		const pool: ArchNode = {
			id: poolId,
			type: 'pool',
			position: { ...node.position },
			width,
			height,
			style: sizeStyle(width, height),
			data: {
				kind: 'pool',
				label: `${data.label} (pool)`,
				capacity: data.capacity,
				version: 1
			}
		};
		const child0: ArchNode = {
			...node,
			parentId: poolId,
			extent: 'parent',
			position: childPos(0),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS
		};
		const child1: ArchNode = {
			id: replicaId,
			type: kind,
			parentId: poolId,
			extent: 'parent',
			position: childPos(1),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS,
			data: { ...node.data }
		};
		const lb: ArchNode = {
			id: lbId,
			type: 'load-balancer',
			position: { x: node.position.x - 210, y: node.position.y },
			data: { kind: 'load-balancer', ...getDef('load-balancer').create() } as ArchData
		};

		const others = this.nodes.filter((n) => n.id !== node.id);
		this.nodes = [...others, lb, pool, child0, child1];

		// Rewire: inbound edges now feed the LB, outbound edges leave the pool.
		const rewired = this.edges.map((e) => {
			if (e.target === node.id) return { ...e, target: lbId };
			if (e.source === node.id) return { ...e, source: poolId };
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
		const kind = template?.data.kind;
		if (kind !== 'service' && kind !== 'monolith') return null;

		const replicaId = this.#id(kind);
		const count = kids.length + 1;
		const { width, height } = poolSize(count);
		const replica: ArchNode = {
			id: replicaId,
			type: kind,
			parentId: poolId,
			extent: 'parent',
			position: childPos(kids.length),
			width: CHILD_W,
			style: `width: ${CHILD_W}px;`,
			...CHILD_FLAGS,
			data: { ...template!.data, capacity: pool.data.capacity }
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
			if (n.id === poolId && n.data.kind === 'pool') return { ...n, data: { ...n.data, capacity } };
			if (n.parentId === poolId && (n.data.kind === 'service' || n.data.kind === 'monolith'))
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

	// ---- Monolith module editing -------------------------------------------

	addModule(monolithId: string): string | null {
		const mono = this.nodes.find((n) => n.id === monolithId);
		if (mono?.data.kind !== 'monolith') return null;
		const moduleId = `mod-${++this.#seq}`;
		const label = `Módulo ${mono.data.modules.length + 1}`;
		this.updateData(monolithId, { modules: [...mono.data.modules, { id: moduleId, label }] });
		return moduleId;
	}

	renameModule(monolithId: string, moduleId: string, label: string) {
		const mono = this.nodes.find((n) => n.id === monolithId);
		if (mono?.data.kind !== 'monolith') return;
		this.updateData(monolithId, {
			modules: mono.data.modules.map((m) => (m.id === moduleId ? { ...m, label } : m))
		});
	}

	removeModule(monolithId: string, moduleId: string) {
		const mono = this.nodes.find((n) => n.id === monolithId);
		if (mono?.data.kind !== 'monolith') return;
		this.updateData(monolithId, {
			modules: mono.data.modules.filter((m) => m.id !== moduleId)
		});
	}

	// ---- Architecture conversions ------------------------------------------

	/** The gateway feeding every one of `ids` directly, or null. */
	commonGateway(ids: string[]): string | null {
		for (const g of this.nodes.filter((n) => n.data.kind === 'api-gateway')) {
			const targets = new Set(this.edges.filter((e) => e.source === g.id).map((e) => e.target));
			if (ids.every((id) => targets.has(id))) return g.id;
		}
		return null;
	}

	/** Standalone services within a selection (ignores a co-selected gateway, etc.). */
	#selectedServiceIds(ids: string[]): string[] {
		return ids.filter((id) => {
			const n = this.nodes.find((x) => x.id === id);
			return !!n && n.data.kind === 'service' && !n.parentId;
		});
	}

	/**
	 * Can these selected nodes collapse into a monolith? Needs 2+ standalone
	 * services sharing one gateway. The shared gateway may itself be in the
	 * selection (Ctrl-clicking it must not break the merge).
	 */
	canMonolithize(ids: string[]): boolean {
		const svcIds = this.#selectedServiceIds(ids);
		if (svcIds.length < 2) return false;
		const gw = this.commonGateway(svcIds);
		if (!gw) return false;
		// Allow only the services and (optionally) their shared gateway in the selection.
		return ids.every((id) => id === gw || svcIds.includes(id));
	}

	/**
	 * Explode a monolith into one service per module behind a new API gateway.
	 * If the monolith had a database, each service gets its own (database-per-
	 * service); otherwise none. Inbound traffic is rewired to the gateway.
	 */
	monolithToMicroservices(id: string): string | null {
		const mono = this.nodes.find((n) => n.id === id);
		if (mono?.data.kind !== 'monolith' || mono.data.modules.length < 2) return null;

		const dbEdge = this.edges.find(
			(e) => e.source === id && this.nodes.find((n) => n.id === e.target)?.data.kind === 'database'
		);
		const db = dbEdge ? this.nodes.find((n) => n.id === dbEdge.target) : null;

		const monoLang = mono.data.language;
		const COL = 240;
		const ROW = 130;
		const gwId = this.#id('api-gateway');
		const gw: ArchNode = {
			id: gwId,
			type: 'api-gateway',
			position: { ...mono.position },
			data: { kind: 'api-gateway', ...getDef('api-gateway').create() } as ArchData
		};

		const newNodes: ArchNode[] = [gw];
		const newEdges: Edge[] = [];
		mono.data.modules.forEach((m, i) => {
			const sid = this.#id('service');
			newNodes.push({
				id: sid,
				type: 'service',
				position: { x: mono.position.x + COL, y: mono.position.y + i * ROW },
				data: {
					kind: 'service',
					label: m.label,
					capacity: 500,
					version: 1,
					...(monoLang ? { language: monoLang } : {})
				}
			});
			newEdges.push({ id: `e-${gwId}-${sid}`, source: gwId, target: sid, type: 'load' });
			if (db && db.data.kind === 'database') {
				const did = this.#id('database');
				newNodes.push({
					id: did,
					type: 'database',
					position: { x: mono.position.x + COL * 2, y: mono.position.y + i * ROW },
					data: { ...db.data, label: `${m.label} db` }
				});
				newEdges.push({ id: `e-${sid}-${did}`, source: sid, target: did, type: 'load' });
			}
		});

		const drop = new Set([id, ...(db ? [db.id] : [])]);
		const rewired = this.edges
			.filter((e) => e.source !== id) // drop monolith outbound (incl. -> db)
			.filter((e) => !db || (e.source !== db.id && e.target !== db.id))
			.map((e) => (e.target === id ? { ...e, target: gwId } : e));

		this.nodes = [...this.nodes.filter((n) => !drop.has(n.id)), ...newNodes];
		this.edges = [...rewired, ...newEdges];
		return gwId;
	}

	/**
	 * Collapse selected services (sharing one gateway) into a single monolith.
	 * Their private databases merge into one shared database. The gateway is
	 * removed when no other services remain behind it; otherwise it keeps
	 * routing to the new monolith alongside the survivors.
	 */
	microservicesToMonolith(ids: string[]): string | null {
		if (!this.canMonolithize(ids)) return null;
		const svcIds = this.#selectedServiceIds(ids);
		const services = svcIds.map((id) => this.nodes.find((n) => n.id === id)!);
		const gwId = this.commonGateway(svcIds)!;
		const gw = this.nodes.find((n) => n.id === gwId)!;

		// Private databases of the selected services.
		// Local collection set, not reactive state — SvelteSet would be inappropriate.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const dbIds = new Set<string>();
		for (const s of services)
			for (const e of this.edges)
				if (
					e.source === s.id &&
					this.nodes.find((n) => n.id === e.target)?.data.kind === 'database'
				)
					dbIds.add(e.target);
		const dbList = [...dbIds];
		const sharedDb = dbList[0] ?? null;

		const monoId = this.#id('monolith');
		const mono: ArchNode = {
			id: monoId,
			type: 'monolith',
			position: { ...gw.position },
			data: {
				kind: 'monolith',
				label: 'Monolito',
				capacity: 900,
				version: 1,
				modules: services.map((s) => ({ id: `mod-${++this.#seq}`, label: s.data.label }))
			}
		};

		const selSet = new Set(svcIds);
		const gwTargets = this.edges.filter((e) => e.source === gwId).map((e) => e.target);
		const remaining = gwTargets.filter((t) => !selSet.has(t));
		const removeGw = remaining.length === 0;

		const dropNodes = new Set([...svcIds, ...dbList.slice(1), ...(removeGw ? [gwId] : [])]);
		const keep = this.nodes.filter((n) => !dropNodes.has(n.id));

		const newEdges: Edge[] = [];
		if (sharedDb)
			newEdges.push({
				id: `e-${monoId}-${sharedDb}`,
				source: monoId,
				target: sharedDb,
				type: 'load'
			});
		if (!removeGw)
			newEdges.push({ id: `e-${gwId}-${monoId}`, source: gwId, target: monoId, type: 'load' });

		const edgesKept = this.edges
			.filter((e) => !selSet.has(e.source) && !selSet.has(e.target))
			.filter((e) => !dbList.slice(1).some((d) => d === e.source || d === e.target))
			.filter((e) => !(removeGw && e.source === gwId)) // drop gateway outbound when removed
			.map((e) => (removeGw && e.target === gwId ? { ...e, target: monoId } : e));

		this.nodes = [...keep, mono];
		this.edges = [...edgesKept, ...newEdges];
		return monoId;
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
	 * Add a graph (e.g. a preset recipe) onto the current canvas. Ids are remapped
	 * to fresh ones (rewiring edges, parentId and gateway weights) so nothing
	 * collides, and the incoming nodes are shifted to sit just right of what's
	 * already there. Reuses the same pool normalization as {@link load}.
	 */
	merge(snapshot: { nodes: ArchNode[]; edges: Edge[] }) {
		const { snapshot: remapped } = remapIds(
			{ version: 0, nodes: snapshot.nodes ?? [], edges: snapshot.edges ?? [] },
			(k) => this.#id(k)
		);
		const cur = boundsOf(this.nodes);
		const incoming = boundsOf(remapped.nodes);
		let placed = remapped.nodes;
		if (cur && incoming) {
			placed = offsetPositions(
				remapped.nodes,
				cur.maxX + MERGE_GAP - incoming.minX,
				cur.minY - incoming.minY
			);
		}
		this.nodes = [...this.nodes, ...placed];
		this.edges = [...this.edges, ...remapped.edges];
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
					data:
						n.data.kind === 'service' || n.data.kind === 'monolith'
							? { ...n.data, capacity: cap }
							: n.data
				};
			});
		}
		this.nodes = nodes;
	}
}

export const graph = new GraphStore();
