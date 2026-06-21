import { describe, it, expect } from 'vitest';
import { migrate } from '$lib/persistence/migrate';
import { validateGraph } from '../validate';
import { presetLibrary, searchPresets, summarize } from './index';

describe('preset library', () => {
	it('ships at least the six expected presets', () => {
		const ids = presetLibrary.map((e) => e.preset.meta.id);
		for (const id of ['wordpress', 'instagram', 'shopify', 'netflix', 'uber', 'ifood']) {
			expect(ids).toContain(id);
		}
	});

	// Every preset must survive migrate + validate with NO repairs: a dropped node
	// or edge means the recipe violates a port rule or references a missing id.
	for (const entry of presetLibrary) {
		it(`"${entry.preset.meta.id}" validates with no repairs`, () => {
			const migrated = migrate(entry.preset.graph);
			const { nodes, edges, warnings } = validateGraph(migrated);
			expect(warnings).toEqual([]);
			expect(nodes.length).toBe(entry.preset.graph.nodes.length);
			expect(edges.length).toBe(entry.preset.graph.edges.length);
		});
	}

	it('summarize produces count tags for the meaningful kinds', () => {
		const wp = presetLibrary.find((e) => e.preset.meta.id === 'wordpress')!;
		const tags = summarize(wp.preset.graph);
		expect(tags).toContain('1 cache');
		expect(tags.some((t) => t.endsWith('banco') || t.endsWith('bancos'))).toBe(true);
		expect(tags.some((t) => t.endsWith('monolitos'))).toBe(true);
	});

	it('searches by name (typo-tolerant), description and elements', () => {
		expect(searchPresets('wordpres').map((e) => e.preset.meta.id)).toContain('wordpress');
		// "fila" only appears in presets that have a broker.
		const queue = searchPresets('fila').map((e) => e.preset.meta.id);
		expect(queue).toContain('uber');
		expect(queue).toContain('ifood');
		// empty query returns the full library in order.
		expect(searchPresets('   ')).toEqual(presetLibrary);
	});
});
