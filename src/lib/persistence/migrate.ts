import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

export const CURRENT_VERSION = 5;

export type Snapshot = {
	version: number;
	nodes: ArchNode[];
	edges: Edge[];
};

/** Loosely-typed snapshot as read from disk/localStorage (any historical shape). */
export type AnySnapshot = {
	version?: number;
	/** legacy v1 field */
	v?: number;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	nodes?: any[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	edges?: any[];
};

/**
 * Migration chain, keyed by the version a step upgrades *from*. Add a new entry
 * (and bump CURRENT_VERSION) whenever the persisted shape changes, so older
 * diagrams keep loading as the app evolves.
 */
export const MIGRATIONS: Record<number, (s: AnySnapshot) => AnySnapshot> = {
	// v1 (had `service.replicas`, no capacities) -> v2 (capacity-based simulation)
	1: (s) => ({
		version: 2,
		nodes: (s.nodes ?? []).map((n) => {
			const data = { ...(n.data ?? {}) };
			if (data.kind === 'service') {
				delete data.replicas;
				data.capacity ??= 500;
			} else if (data.kind === 'database') {
				data.capacity ??= 1000;
			} else if (data.kind === 'api-gateway') {
				data.capacity ??= 5000;
			}
			return { ...n, data };
		}),
		edges: (s.edges ?? []).map((e) => ({ type: 'load', ...e }))
	}),
	// v2 -> v3: pools gain a per-replica `capacity`; replicas become
	// non-interactive (the pool wrapper is the unit that moves/connects).
	2: (s) => {
		const nodes = s.nodes ?? [];
		const poolIds = new Set(nodes.filter((n) => n.data?.kind === 'pool').map((n) => n.id));
		return {
			version: 3,
			nodes: nodes.map((n) => {
				if (n.data?.kind === 'pool') {
					const kids = nodes.filter((c) => c.parentId === n.id);
					const cap = kids.find((c) => typeof c.data?.capacity === 'number')?.data.capacity ?? 500;
					return { ...n, data: { ...n.data, capacity: n.data.capacity ?? cap } };
				}
				if (n.parentId && poolIds.has(n.parentId)) {
					return { ...n, draggable: false, selectable: false, connectable: false };
				}
				return n;
			}),
			edges: s.edges ?? []
		};
	},
	// v3 -> v4: deployable nodes (service/pool/monolith) gain a `version`.
	3: (s) => ({
		version: 4,
		nodes: (s.nodes ?? []).map((n) => {
			const k = n.data?.kind;
			if (k === 'service' || k === 'pool' || k === 'monolith') {
				return { ...n, data: { ...n.data, version: n.data.version ?? 1 } };
			}
			return n;
		}),
		edges: s.edges ?? []
	}),
	// v4 -> v5: databases gain a scaling `mode` (replicas/sharding); `capacity`
	// is reinterpreted as per-instance. Single-mode keeps the legacy behaviour.
	4: (s) => ({
		version: 5,
		nodes: (s.nodes ?? []).map((n) => {
			if (n.data?.kind !== 'database') return n;
			const data = { ...n.data };
			data.mode ??= 'single';
			data.replicaCount ??= 2;
			data.readRatio ??= 0.8;
			data.shardCount ??= 2;
			data.skew ??= 0;
			return { ...n, data };
		}),
		edges: s.edges ?? []
	})
};

/** Upgrade any historical snapshot to the current shape. */
export function migrate(raw: AnySnapshot): Snapshot {
	let snap: AnySnapshot = raw;
	let version = raw.version ?? raw.v ?? 1;
	while (version < CURRENT_VERSION) {
		const step = MIGRATIONS[version];
		if (!step) break;
		snap = step(snap);
		version = snap.version ?? version + 1;
	}
	return {
		version: CURRENT_VERSION,
		nodes: (snap.nodes ?? []) as ArchNode[],
		edges: (snap.edges ?? []) as Edge[]
	};
}
