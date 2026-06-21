import { describe, it, expect } from 'vitest';
import type { Snapshot } from '$lib/persistence/migrate';
import { validateGraph } from './validate';

describe('validateGraph', () => {
	it('drops nodes with an unknown kind', () => {
		const snap = {
			version: 4,
			nodes: [
				{ id: 'x-1', type: 'mystery', position: { x: 0, y: 0 }, data: { kind: 'mystery' } },
				{
					id: 'load-1',
					type: 'load',
					position: { x: 0, y: 0 },
					data: { kind: 'load', label: 'l', rps: 100 }
				}
			],
			edges: []
		} as unknown as Snapshot;

		const { nodes, warnings } = validateGraph(snap);
		expect(nodes.map((n) => n.id)).toEqual(['load-1']);
		expect(warnings.some((w) => w.includes('mystery'))).toBe(true);
	});

	it('backfills missing data fields with registry defaults', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'service-1',
					type: 'service',
					position: { x: 0, y: 0 },
					data: { kind: 'service', label: 'keep' }
				}
			],
			edges: []
		} as unknown as Snapshot;

		const { nodes } = validateGraph(snap);
		const d = nodes[0].data as { label: string; capacity: number; version: number };
		expect(d.label).toBe('keep'); // existing value preserved
		expect(d.capacity).toBe(500); // default filled
		expect(d.version).toBe(1); // default filled
	});

	it('drops edges that violate the port rules', () => {
		// database has no `out` port, so database -> load is invalid
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'database-1',
					type: 'database',
					position: { x: 0, y: 0 },
					data: {
						kind: 'database',
						label: 'd',
						engine: 'postgres',
						persistent: true,
						capacity: 1000
					}
				},
				{
					id: 'load-1',
					type: 'load',
					position: { x: 0, y: 0 },
					data: { kind: 'load', label: 'l', rps: 100 }
				}
			],
			edges: [{ id: 'database-1->load-1', source: 'database-1', target: 'load-1', type: 'load' }]
		} as unknown as Snapshot;

		const { edges, warnings } = validateGraph(snap);
		expect(edges).toHaveLength(0);
		expect(warnings.some((w) => w.includes('database-1->load-1'))).toBe(true);
	});

	it('drops orphan edges pointing at missing nodes', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'load-1',
					type: 'load',
					position: { x: 0, y: 0 },
					data: { kind: 'load', label: 'l', rps: 100 }
				}
			],
			edges: [{ id: 'load-1->ghost', source: 'load-1', target: 'ghost', type: 'load' }]
		} as unknown as Snapshot;

		const { edges, warnings } = validateGraph(snap);
		expect(edges).toHaveLength(0);
		expect(warnings.length).toBeGreaterThan(0);
	});

	it('clears a parentId that does not point at a pool', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'load-1',
					type: 'load',
					position: { x: 0, y: 0 },
					data: { kind: 'load', label: 'l', rps: 100 }
				},
				{
					id: 'service-1',
					type: 'service',
					parentId: 'load-1',
					position: { x: 0, y: 0 },
					data: { kind: 'service', label: 's', capacity: 500, version: 1 }
				}
			],
			edges: []
		} as unknown as Snapshot;

		const { nodes, warnings } = validateGraph(snap);
		expect(nodes.find((n) => n.id === 'service-1')!.parentId).toBeUndefined();
		expect(warnings.some((w) => w.includes('parentId'))).toBe(true);
	});

	it('keeps synchronous service↔service and service↔monolith call edges', () => {
		const node = (id: string, kind: string, data: Record<string, unknown>) => ({
			id,
			type: kind,
			position: { x: 0, y: 0 },
			data: { kind, label: id, ...data }
		});
		const snap = {
			version: 4,
			nodes: [
				node('service-1', 'service', { capacity: 500, version: 1 }),
				node('service-2', 'service', { capacity: 500, version: 1 }),
				node('monolith-1', 'monolith', { capacity: 500, version: 1, modules: [] })
			],
			edges: [
				{ id: 'service-1->service-2', source: 'service-1', target: 'service-2', type: 'load' },
				{ id: 'service-1->monolith-1', source: 'service-1', target: 'monolith-1', type: 'load' },
				{ id: 'monolith-1->service-2', source: 'monolith-1', target: 'service-2', type: 'load' }
			]
		} as unknown as Snapshot;

		const { edges, warnings } = validateGraph(snap);
		expect(edges.map((e) => e.id)).toEqual([
			'service-1->service-2',
			'service-1->monolith-1',
			'monolith-1->service-2'
		]);
		expect(warnings).toHaveLength(0);
	});

	it('sanitizes a malformed edge amplification to an integer ≥ 1', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'service-1',
					type: 'service',
					position: { x: 0, y: 0 },
					data: { kind: 'service', label: 'a', capacity: 500, version: 1 }
				},
				{
					id: 'service-2',
					type: 'service',
					position: { x: 0, y: 0 },
					data: { kind: 'service', label: 'b', capacity: 500, version: 1 }
				}
			],
			edges: [
				{
					id: 'service-1->service-2',
					source: 'service-1',
					target: 'service-2',
					type: 'load',
					data: { amplification: 2.7 }
				}
			]
		} as unknown as Snapshot;

		const { edges } = validateGraph(snap);
		expect((edges[0].data as { amplification: number }).amplification).toBe(3);
	});

	it('passes a valid graph through with no warnings', () => {
		const snap = {
			version: 4,
			nodes: [
				{
					id: 'load-1',
					type: 'load',
					position: { x: 0, y: 0 },
					data: { kind: 'load', label: 'l', rps: 100 }
				},
				{
					id: 'service-1',
					type: 'service',
					position: { x: 0, y: 0 },
					data: { kind: 'service', label: 's', capacity: 500, version: 1 }
				}
			],
			edges: [{ id: 'load-1->service-1', source: 'load-1', target: 'service-1', type: 'load' }]
		} as unknown as Snapshot;

		const { nodes, edges, warnings } = validateGraph(snap);
		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);
		expect(warnings).toHaveLength(0);
	});
});
