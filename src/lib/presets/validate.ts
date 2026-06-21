import type { Edge } from '@xyflow/svelte';
import type { ArchData, ArchNode, NodeKind } from '$lib/registry/types';
import type { Snapshot } from '$lib/persistence/migrate';
import { registry, getDef, canConnect } from '$lib/registry';

export type ValidationResult = {
	nodes: ArchNode[];
	edges: Edge[];
	warnings: string[];
};

function isKnownKind(kind: unknown): kind is NodeKind {
	return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(registry, kind);
}

/**
 * Tolerant validation/repair of a graph against the registry and port rules.
 * Drops unknown node kinds, edges that are orphaned or violate `canConnect`,
 * and broken `parentId` references; fills missing node data with registry
 * defaults. Returns the repaired graph plus a list of human-readable warnings
 * describing what was changed. Never throws — an empty result is valid output.
 */
export function validateGraph(snapshot: Snapshot): ValidationResult {
	const warnings: string[] = [];

	// 1. Keep nodes with a known kind; backfill missing data fields from defaults.
	const nodes: ArchNode[] = [];
	for (const n of snapshot.nodes) {
		const kind = (n.data as ArchData | undefined)?.kind;
		if (!isKnownKind(kind)) {
			warnings.push(`Nó "${n.id}" descartado: tipo desconhecido "${String(kind)}".`);
			continue;
		}
		const defaults = getDef(kind).create();
		nodes.push({ ...n, data: { ...defaults, ...n.data, kind } as ArchData });
	}

	const byId = new Map(nodes.map((n) => [n.id, n]));
	const isPool = (id: string) => byId.get(id)?.data.kind === 'pool';

	// 2. Repair broken parentId references (parent dropped or not a pool).
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		if (n.parentId && !isPool(n.parentId)) {
			warnings.push(`Nó "${n.id}": parentId "${n.parentId}" inválido, removido.`);
			nodes[i] = {
				...n,
				parentId: undefined,
				extent: undefined,
				draggable: true,
				selectable: true,
				connectable: true
			};
		}
	}

	// 3. Keep edges whose endpoints exist and whose port rule allows them.
	const edges: Edge[] = [];
	for (const e of snapshot.edges) {
		const src = byId.get(e.source);
		const dst = byId.get(e.target);
		if (!src || !dst) {
			warnings.push(`Aresta "${e.id}" descartada: extremidade inexistente.`);
			continue;
		}
		if (!canConnect(src.data.kind, dst.data.kind)) {
			warnings.push(
				`Aresta "${e.id}" descartada: ${src.data.kind} → ${dst.data.kind} não permitido.`
			);
			continue;
		}
		// Sanitize a malformed amplification factor (integer ≥ 1) so a corrupt
		// import can never inject a NaN/0 into the sim's edge flows.
		const amp = (e.data as { amplification?: unknown } | undefined)?.amplification;
		const data =
			amp == null
				? e.data
				: { ...e.data, amplification: Math.max(1, Math.round(Number(amp)) || 1) };
		edges.push({ ...e, data, type: 'load' });
	}

	return { nodes, edges, warnings };
}
