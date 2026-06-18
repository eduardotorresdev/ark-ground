import { describe, it, expect } from 'vitest';
import { detectQuanta } from './quanta';
import type { ArchNode } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

const at = { x: 0, y: 0 };

const load = (id: string): ArchNode => ({
	id,
	type: 'load',
	position: at,
	data: { kind: 'load', label: id, rps: 100 }
});
const service = (id: string, parentId?: string): ArchNode => ({
	id,
	type: 'service',
	position: at,
	data: { kind: 'service', label: id, capacity: 500, version: 1 },
	...(parentId ? { parentId, extent: 'parent' as const } : {})
});
const database = (id: string): ArchNode => ({
	id,
	type: 'database',
	position: at,
	data: { kind: 'database', label: id, engine: 'postgres', persistent: true, capacity: 2000 }
});
const gateway = (id: string): ArchNode => ({
	id,
	type: 'api-gateway',
	position: at,
	data: { kind: 'api-gateway', label: id, capacity: 100000 }
});
const pool = (id: string): ArchNode => ({
	id,
	type: 'pool',
	position: at,
	data: { kind: 'pool', label: id, capacity: 500, version: 1 }
});
const edge = (source: string, target: string): Edge => ({ id: `${source}->${target}`, source, target });

/** Sorted member ids of every quantum, for order-independent assertions. */
const members = (nodes: ArchNode[], edges: Edge[]) =>
	detectQuanta(nodes, edges)
		.map((q) => [...q.nodeIds].sort())
		.sort((a, b) => a[0].localeCompare(b[0]));

describe('detectQuanta', () => {
	it('groups a service and its database into one quantum', () => {
		const nodes = [service('s'), database('d')];
		const edges = [edge('s', 'd')];
		expect(members(nodes, edges)).toEqual([['d', 's']]);
	});

	it('merges services that share a database into a single quantum', () => {
		const nodes = [service('s1'), service('s2'), database('d')];
		const edges = [edge('s1', 'd'), edge('s2', 'd')];
		expect(members(nodes, edges)).toEqual([['d', 's1', 's2']]);
	});

	it('keeps disconnected service+db pairs as separate quanta', () => {
		const nodes = [service('s1'), database('d1'), service('s2'), database('d2')];
		const edges = [edge('s1', 'd1'), edge('s2', 'd2')];
		expect(members(nodes, edges)).toEqual([
			['d1', 's1'],
			['d2', 's2']
		]);
	});

	it('excludes load generators from the quantum', () => {
		const nodes = [load('g'), service('s'), database('d')];
		const edges = [edge('g', 's'), edge('s', 'd')];
		expect(members(nodes, edges)).toEqual([['d', 's']]);
	});

	it('ignores infra-only components with no service or pool', () => {
		const nodes = [gateway('gw'), database('d'), service('s')];
		// gw+d are connected to each other but carry no service; s is its own quantum.
		const edges = [edge('gw', 'd')];
		expect(members(nodes, edges)).toEqual([['s']]);
	});

	it('treats a standalone service as its own quantum', () => {
		const nodes = [service('s')];
		expect(members(nodes, [])).toEqual([['s']]);
	});

	it('uses the pool (not its replicas) as the quantum member', () => {
		const nodes = [pool('p'), service('r1', 'p'), service('r2', 'p'), database('d')];
		const edges = [edge('p', 'd')];
		// Replicas live inside the pool and never appear as quantum members.
		expect(members(nodes, edges)).toEqual([['d', 'p']]);
	});
});
