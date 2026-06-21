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
const broker = (id: string): ArchNode => ({
	id,
	type: 'broker',
	position: at,
	data: {
		kind: 'broker',
		label: id,
		mode: 'work-queue',
		bufferSize: 10000,
		maxDeliveryRate: 10000,
		fullPolicy: 'drop'
	}
});
const edge = (source: string, target: string): Edge => ({
	id: `${source}->${target}`,
	source,
	target
});

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

	it('couples a synchronous service→service call into one quantum', () => {
		// A synchronous call binds lifecycles (backpressure propagates), so the two
		// services are one deployable unit — unlike an async broker hop.
		const nodes = [service('a'), service('b')];
		const edges = [edge('a', 'b')];
		expect(members(nodes, edges)).toEqual([['a', 'b']]);
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
		// The gateway is transparent and the lone db carries no service; only s
		// forms a quantum.
		const edges = [edge('gw', 'd')];
		expect(members(nodes, edges)).toEqual([['s']]);
	});

	it('splits services behind a shared gateway into separate quanta', () => {
		// Gateway fans out to two services, each with its own private database.
		// The shared gateway is routing infra, not static coupling: two quanta.
		const nodes = [
			gateway('gw'),
			service('post'),
			database('post-db'),
			service('users'),
			database('users-db')
		];
		const edges = [
			edge('gw', 'post'),
			edge('gw', 'users'),
			edge('post', 'post-db'),
			edge('users', 'users-db')
		];
		expect(members(nodes, edges)).toEqual([
			['post', 'post-db'],
			['users', 'users-db']
		]);
	});

	it('keeps services sharing a database in one quantum even behind a gateway', () => {
		// A shared db statically couples the two services into one quantum.
		const nodes = [gateway('gw'), service('s1'), service('s2'), database('shared')];
		const edges = [edge('gw', 's1'), edge('gw', 's2'), edge('s1', 'shared'), edge('s2', 'shared')];
		expect(members(nodes, edges)).toEqual([['s1', 's2', 'shared']]);
	});

	it('treats a standalone service as its own quantum', () => {
		const nodes = [service('s')];
		expect(members(nodes, [])).toEqual([['s']]);
	});

	it('splits producer and consumer across a broker into separate quanta', () => {
		// Async communication decouples lifecycles: a producer and a consumer that
		// only talk through a broker are independently deployable.
		const nodes = [service('producer'), broker('mq'), service('consumer'), database('cdb')];
		const edges = [edge('producer', 'mq'), edge('mq', 'consumer'), edge('consumer', 'cdb')];
		expect(members(nodes, edges)).toEqual([['cdb', 'consumer'], ['producer']]);
	});

	it('uses the pool (not its replicas) as the quantum member', () => {
		const nodes = [pool('p'), service('r1', 'p'), service('r2', 'p'), database('d')];
		const edges = [edge('p', 'd')];
		// Replicas live inside the pool and never appear as quantum members.
		expect(members(nodes, edges)).toEqual([['d', 'p']]);
	});
});
