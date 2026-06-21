import { describe, it, expect } from 'vitest';
import type { Snapshot } from '$lib/persistence/migrate';
import type { ArchNode, NodeKind } from '$lib/registry/types';
import { remapIds, boundsOf, offsetPositions } from './remap';

function counter() {
	let i = 100;
	return (kind: NodeKind) => `${kind}-${++i}`;
}

describe('remapIds', () => {
	const snap = {
		version: 4,
		nodes: [
			{
				id: 'api-gateway-1',
				type: 'api-gateway',
				position: { x: 0, y: 0 },
				data: { kind: 'api-gateway', label: 'gw', capacity: 5000, weights: { 'service-1': 3 } }
			},
			{
				id: 'service-1',
				type: 'service',
				position: { x: 100, y: 0 },
				data: { kind: 'service', label: 's', capacity: 500, version: 1 }
			},
			{
				id: 'pool-1',
				type: 'pool',
				position: { x: 200, y: 0 },
				width: 200,
				height: 200,
				data: { kind: 'pool', label: 'p', capacity: 500, version: 1 }
			},
			{
				id: 'service-2',
				type: 'service',
				parentId: 'pool-1',
				extent: 'parent',
				position: { x: 16, y: 98 },
				data: { kind: 'service', label: 'r', capacity: 500, version: 1 }
			}
		],
		edges: [
			{ id: 'api-gateway-1->service-1', source: 'api-gateway-1', target: 'service-1', type: 'load' }
		]
	} as Snapshot;

	it('assigns a fresh id to every node', () => {
		const { idMap } = remapIds(snap, counter());
		expect(idMap.size).toBe(4);
		expect([...idMap.values()].every((v) => v.endsWith('-101') || /-\d{3}$/.test(v))).toBe(true);
		// no remapped id collides with an original id
		const originals = new Set(snap.nodes.map((n) => n.id));
		expect([...idMap.values()].some((v) => originals.has(v))).toBe(false);
	});

	it('rewrites edge endpoints and edge id', () => {
		const { snapshot, idMap } = remapIds(snap, counter());
		const e = snapshot.edges[0];
		expect(e.source).toBe(idMap.get('api-gateway-1'));
		expect(e.target).toBe(idMap.get('service-1'));
		expect(e.id).toBe(`${e.source}->${e.target}`);
	});

	it('remaps the keys of a gateway weights map', () => {
		const { snapshot, idMap } = remapIds(snap, counter());
		const gw = snapshot.nodes.find((n) => n.data.kind === 'api-gateway')!;
		const weights = (gw.data as { weights?: Record<string, number> }).weights!;
		expect(weights[idMap.get('service-1')!]).toBe(3);
		expect(weights['service-1']).toBeUndefined();
	});

	it('remaps a replica parentId to the new pool id', () => {
		const { snapshot, idMap } = remapIds(snap, counter());
		const replica = snapshot.nodes.find((n) => n.position.y === 98)!;
		expect(replica.parentId).toBe(idMap.get('pool-1'));
	});
});

describe('boundsOf', () => {
	it('uses width/height and ignores replicas', () => {
		const nodes = [
			{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50, data: { kind: 'service' } },
			{
				id: 'b',
				parentId: 'pool-1',
				position: { x: 999, y: 999 },
				data: { kind: 'service' }
			}
		] as unknown as ArchNode[];
		const b = boundsOf(nodes)!;
		expect(b).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
	});

	it('returns null when there are no top-level nodes', () => {
		expect(boundsOf([])).toBeNull();
	});
});

describe('offsetPositions', () => {
	it('shifts top-level nodes but leaves replicas (pool-relative) alone', () => {
		const nodes = [
			{ id: 'a', position: { x: 10, y: 10 }, data: { kind: 'service' } },
			{ id: 'b', parentId: 'pool-1', position: { x: 5, y: 5 }, data: { kind: 'service' } }
		] as unknown as ArchNode[];
		const out = offsetPositions(nodes, 100, 20);
		expect(out[0].position).toEqual({ x: 110, y: 30 });
		expect(out[1].position).toEqual({ x: 5, y: 5 });
	});
});
