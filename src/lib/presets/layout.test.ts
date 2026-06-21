import { describe, it, expect } from 'vitest';
import type { Snapshot } from '$lib/persistence/migrate';
import { autoLayout } from './layout';

describe('autoLayout', () => {
	it('lays out nodes by depth from sources, left to right', () => {
		const snap = {
			version: 4,
			nodes: [
				{ id: 'load-1', type: 'load', data: { kind: 'load', label: 'l', rps: 100 } },
				{
					id: 'service-1',
					type: 'service',
					data: { kind: 'service', label: 's', capacity: 500, version: 1 }
				},
				{
					id: 'database-1',
					type: 'database',
					data: {
						kind: 'database',
						label: 'd',
						engine: 'postgres',
						persistent: true,
						capacity: 1000
					}
				}
			],
			edges: [
				{ id: 'load-1->service-1', source: 'load-1', target: 'service-1', type: 'load' },
				{ id: 'service-1->database-1', source: 'service-1', target: 'database-1', type: 'load' }
			]
		} as unknown as Snapshot;

		const out = autoLayout(snap);
		const x = (id: string) => out.nodes.find((n) => n.id === id)!.position.x;
		expect(x('load-1')).toBe(0);
		expect(x('service-1')).toBe(240);
		expect(x('database-1')).toBe(480);
	});

	it('keeps already-positioned nodes as anchors', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'load-1',
					type: 'load',
					position: { x: 777, y: 333 },
					data: { kind: 'load', label: 'l', rps: 100 }
				},
				{
					id: 'service-1',
					type: 'service',
					data: { kind: 'service', label: 's', capacity: 500, version: 1 }
				}
			],
			edges: [{ id: 'load-1->service-1', source: 'load-1', target: 'service-1', type: 'load' }]
		} as unknown as Snapshot;

		const out = autoLayout(snap);
		expect(out.nodes.find((n) => n.id === 'load-1')!.position).toEqual({ x: 777, y: 333 });
		// the unpositioned node still gets laid out (level 1 → x=240)
		expect(out.nodes.find((n) => n.id === 'service-1')!.position.x).toBe(240);
	});

	it('returns the snapshot untouched when every node already has a position', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'load-1',
					type: 'load',
					position: { x: 1, y: 2 },
					data: { kind: 'load', label: 'l', rps: 100 }
				}
			],
			edges: []
		} as unknown as Snapshot;
		const out = autoLayout(snap);
		expect(out).toBe(snap);
	});
});
