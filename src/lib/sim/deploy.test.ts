import { describe, it, expect } from 'vitest';
import { capMultiplier } from './deployMath';
import { computeSim } from './engine';
import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

const at = { x: 0, y: 0 };

describe('capMultiplier', () => {
	it('recreate drops all capacity', () => {
		expect(capMultiplier('recreate', 3)).toBe(0);
	});
	it('blue-green keeps full capacity', () => {
		expect(capMultiplier('blue-green', 3)).toBe(1);
	});
	it('rolling removes one replica at a time', () => {
		expect(capMultiplier('rolling', 4)).toBe(0.75);
		expect(capMultiplier('rolling', 1)).toBe(0);
	});
});

describe('computeSim with capMult (deploy downtime)', () => {
	const load: ArchNode = {
		id: 'l',
		type: 'load',
		position: at,
		data: { kind: 'load', label: 'l', rps: 100 }
	};
	const svc: ArchNode = {
		id: 's',
		type: 'service',
		position: at,
		data: { kind: 'service', label: 's', capacity: 200, version: 1 }
	};
	const edges: Edge[] = [{ id: 'l->s', source: 'l', target: 's', type: 'load' }];

	it('serves normally with no deploy', () => {
		const r = computeSim([load, svc], edges);
		expect(r.nodes['s'].served).toBe(100);
		expect(r.nodes['s'].dropped).toBe(0);
	});

	it('recreate (mult 0) drops everything offered', () => {
		const r = computeSim([load, svc], edges, { s: 0 });
		expect(r.nodes['s'].served).toBe(0);
		expect(r.nodes['s'].dropped).toBe(100);
		expect(r.nodes['s'].level).toBe('crit');
	});
});
