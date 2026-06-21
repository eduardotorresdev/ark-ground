import Fuse from 'fuse.js';
import type { Snapshot } from '$lib/persistence/migrate';
import { getDef } from '$lib/registry';
import { dbModeOption } from '$lib/registry/db-modes';
import { ENGINES } from '$lib/registry/icons';
import type { NodeKind } from '$lib/registry/types';
import { wordpress } from './wordpress';
import { instagram } from './instagram';
import { shopify } from './shopify';
import { netflix } from './netflix';
import { uber } from './uber';
import { ifood } from './ifood';
import { CATEGORY_LABEL, type PresetCategory, type PresetEntry } from './types';

export { CATEGORY_LABEL };
export type { PresetCategory, PresetEntry };

/** All presets, monoliths first then microservices (order = display order). */
export const presetLibrary: PresetEntry[] = [wordpress, instagram, shopify, netflix, uber, ifood];

/** Kinds shown as count tags, in tag order, with pt-BR singular/plural labels. */
const COUNTED: { kind: NodeKind; one: string; many: string }[] = [
	{ kind: 'service', one: 'serviço', many: 'serviços' },
	{ kind: 'monolith', one: 'monolito', many: 'monolitos' },
	{ kind: 'database', one: 'banco', many: 'bancos' },
	{ kind: 'cache', one: 'cache', many: 'caches' },
	{ kind: 'broker', one: 'fila', many: 'filas' }
];

/**
 * Count tags for a preset graph, e.g. ["3 serviços", "3 bancos", "1 fila"].
 * Pool replicas count under their own kind; containers/infra (pool, load,
 * load-balancer, gateway) are omitted to keep the tags about the meaningful pieces.
 */
export function summarize(graph: Snapshot): string[] {
	const tally = new Map<NodeKind, number>();
	for (const n of graph.nodes) {
		tally.set(n.data.kind, (tally.get(n.data.kind) ?? 0) + 1);
	}
	const tags: string[] = [];
	for (const { kind, one, many } of COUNTED) {
		const count = tally.get(kind) ?? 0;
		if (count > 0) tags.push(`${count} ${count === 1 ? one : many}`);
	}
	return tags;
}

/** Free-text search terms for a preset: node labels, kind labels, db modes/engines, broker modes. */
function elementsOf(entry: PresetEntry): string {
	const terms = new Set<string>();
	for (const n of entry.preset.graph.nodes) {
		terms.add(n.data.label);
		terms.add(getDef(n.data.kind).label);
		if (n.data.kind === 'database') {
			const db = n.data; // capture so the narrowing survives inside the closure below
			terms.add(dbModeOption(db.mode).label);
			terms.add(ENGINES.find((e) => e.id === db.engine)?.label ?? db.engine);
		}
		if (n.data.kind === 'broker') terms.add(n.data.mode);
	}
	for (const tag of summarize(entry.preset.graph)) terms.add(tag);
	return [...terms].join(' ');
}

type SearchRow = { entry: PresetEntry; name: string; description: string; elements: string };

const rows: SearchRow[] = presetLibrary.map((entry) => ({
	entry,
	name: entry.preset.meta.name,
	description: entry.preset.meta.description ?? '',
	elements: elementsOf(entry)
}));

const fuse = new Fuse(rows, {
	keys: [
		{ name: 'name', weight: 2 },
		{ name: 'description', weight: 1 },
		{ name: 'elements', weight: 1 }
	],
	threshold: 0.4,
	ignoreLocation: true
});

/** Fuzzy search over name, description and constituent elements. Empty query ⇒ all presets in order. */
export function searchPresets(query: string): PresetEntry[] {
	const q = query.trim();
	if (!q) return presetLibrary;
	return fuse.search(q).map((r) => r.item.entry);
}
