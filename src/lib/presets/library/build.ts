import type { Edge } from '@xyflow/svelte';
import { CURRENT_VERSION, type Snapshot } from '$lib/persistence/migrate';
import { getDef } from '$lib/registry';
import type { ArchNode, DataOf, NodeKind } from '$lib/registry/types';

/**
 * Authoring helpers for preset graphs. Presets are written WITHOUT positions:
 * the sentinel below is non-finite so `autoLayout` treats every top-level node
 * as "missing a position" and lays the graph out left → right, while pool
 * replicas are positioned by `#normalizePools` on load/merge.
 */
const NO_POSITION = { x: NaN, y: NaN };

/** A node with its registry defaults, optional data overrides, and extra node fields (e.g. `parentId`). */
export function node<K extends NodeKind>(
	id: string,
	kind: K,
	data: Partial<Omit<DataOf<K>, 'kind'>> = {},
	extra: Partial<ArchNode> = {}
): ArchNode {
	const defaults = getDef(kind).create() as Omit<DataOf<K>, 'kind'>;
	return {
		id,
		type: kind,
		position: { ...NO_POSITION },
		data: { kind, ...defaults, ...data } as DataOf<K>,
		...extra
	};
}

/** A replica living inside a pool: a service/monolith child wired to its parent pool. */
export function replica<K extends 'service' | 'monolith'>(
	id: string,
	kind: K,
	parentId: string,
	data: Partial<Omit<DataOf<K>, 'kind'>> = {}
): ArchNode {
	return node(id, kind, data, { parentId });
}

/** A load edge between two node ids, with optional synchronous call amplification. */
export function edge(source: string, target: string, amplification?: number): Edge {
	const e: Edge = { id: `${source}->${target}`, source, target, type: 'load' };
	if (amplification != null) e.data = { amplification };
	return e;
}

/** Wrap nodes + edges into a current-version snapshot. */
export function snapshot(nodes: ArchNode[], edges: Edge[]): Snapshot {
	return { version: CURRENT_VERSION, nodes, edges };
}
