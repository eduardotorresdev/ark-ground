import { describe, it, expect } from 'vitest';
import { computeSim, bucket } from './engine';
import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

const at = { x: 0, y: 0 };

const load = (id: string, rps: number): ArchNode => ({
	id,
	type: 'load',
	position: at,
	data: { kind: 'load', label: id, rps }
});
const service = (id: string, capacity: number, parentId?: string): ArchNode => ({
	id,
	type: 'service',
	position: at,
	data: { kind: 'service', label: id, capacity },
	...(parentId ? { parentId, extent: 'parent' as const } : {})
});
const database = (id: string, capacity: number): ArchNode => ({
	id,
	type: 'database',
	position: at,
	data: { kind: 'database', label: id, engine: 'postgres', persistent: true, capacity }
});
const lb = (id: string, algorithm: 'round-robin' | 'weighted' | 'least-connections'): ArchNode => ({
	id,
	type: 'load-balancer',
	position: at,
	data: { kind: 'load-balancer', label: id, algorithm, capacity: 100000 }
});
const pool = (id: string): ArchNode => ({
	id,
	type: 'pool',
	position: at,
	data: { kind: 'pool', label: id, capacity: 500 }
});
const edge = (source: string, target: string): Edge => ({
	id: `${source}->${target}`,
	source,
	target
});

describe('bucket', () => {
	it('maps utilization to the agreed thresholds', () => {
		expect(bucket(0)).toBe('idle');
		expect(bucket(0.5)).toBe('ok');
		expect(bucket(0.7)).toBe('ok');
		expect(bucket(0.85)).toBe('warn');
		expect(bucket(1)).toBe('warn');
		expect(bucket(1.01)).toBe('crit');
	});
});

describe('throttle + downstream propagation', () => {
	it('serves up to capacity, drops the excess, and forwards only the served load', () => {
		const nodes = [load('g', 1000), service('s', 500), database('d', 2000)];
		const edges = [edge('g', 's'), edge('s', 'd')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.s.offered).toBe(1000);
		expect(stat.s.served).toBe(500);
		expect(stat.s.dropped).toBe(500);
		expect(stat.s.level).toBe('crit');

		// the database only sees what the service could serve
		expect(stat.d.offered).toBe(500);
		expect(stat.d.served).toBe(500);
		expect(stat.d.level).toBe('ok');
	});
});

describe('broadcast fan-out', () => {
	it('sends the full served load to every downstream dependency', () => {
		const nodes = [load('g', 300), service('s', 1000), database('a', 5000), database('b', 5000)];
		const edges = [edge('g', 's'), edge('s', 'a'), edge('s', 'b')];
		const { nodes: stat, edges: estat } = computeSim(nodes, edges);

		expect(stat.a.offered).toBe(300);
		expect(stat.b.offered).toBe(300);
		expect(estat['s->a'].load).toBe(300);
		expect(estat['s->b'].load).toBe(300);
	});
});

describe('load balancer split', () => {
	const build = (algorithm: 'round-robin' | 'weighted') => {
		const nodes = [
			load('g', 600),
			lb('lb', algorithm),
			pool('p'),
			service('r1', 400, 'p'),
			service('r2', 200, 'p')
		];
		const edges = [edge('g', 'lb'), edge('lb', 'p')];
		return computeSim(nodes, edges).nodes;
	};

	it('round-robin splits evenly, saturating the smaller replica', () => {
		const stat = build('round-robin');
		expect(stat.r1.offered).toBe(300);
		expect(stat.r2.offered).toBe(300);
		expect(stat.r2.served).toBe(200);
		expect(stat.r2.dropped).toBe(100);
		expect(stat.r2.level).toBe('crit');
		expect(stat.r1.level).toBe('warn'); // 300/400 = 0.75
	});

	it('weighted splits by capacity, keeping every replica at equal utilization', () => {
		const stat = build('weighted');
		expect(stat.r1.offered).toBe(400);
		expect(stat.r2.offered).toBe(200);
		expect(stat.r1.dropped).toBe(0);
		expect(stat.r2.dropped).toBe(0);
		expect(stat.p.served).toBe(600);
	});

	it('flags a pool with no balancer feeding it', () => {
		const nodes = [pool('p'), service('r1', 400, 'p'), service('r2', 400, 'p')];
		const { nodes: stat } = computeSim(nodes, []);
		expect(stat.p.warn).toBe('no-lb');
	});
});

describe('cycles', () => {
	it('does not loop forever and flags the cyclic nodes', () => {
		const nodes = [service('a', 500), service('b', 500)];
		const edges = [edge('a', 'b'), edge('b', 'a')];
		const { nodes: stat } = computeSim(nodes, edges);
		expect(stat.a.cyclic).toBe(true);
		expect(stat.b.cyclic).toBe(true);
	});
});
