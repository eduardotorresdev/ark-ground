import { describe, it, expect } from 'vitest';
import { migrate, CURRENT_VERSION } from './migrate';

describe('migrate v1 -> v2', () => {
	const v1 = {
		v: 1 as const,
		nodes: [
			{
				id: 'service-1',
				type: 'service',
				position: { x: 0, y: 0 },
				data: { kind: 'service', label: 'API', replicas: 3 }
			},
			{
				id: 'database-1',
				type: 'database',
				position: { x: 0, y: 0 },
				data: { kind: 'database', label: 'PG', engine: 'postgres', persistent: true }
			},
			{
				id: 'api-gateway-1',
				type: 'api-gateway',
				position: { x: 0, y: 0 },
				data: { kind: 'api-gateway', label: 'GW', routes: 2 }
			}
		],
		edges: [{ id: 'e1', source: 'service-1', target: 'database-1' }]
	};

	it('drops replicas and injects default capacities', () => {
		const out = migrate(v1);
		const svc = out.nodes[0].data as { capacity: number; replicas?: number };
		expect(out.version).toBe(CURRENT_VERSION);
		expect(svc.replicas).toBeUndefined();
		expect(svc.capacity).toBe(500);
		expect((out.nodes[1].data as { capacity: number }).capacity).toBe(1000);
		expect((out.nodes[2].data as { capacity: number }).capacity).toBe(5000);
	});

	it('tags legacy edges with the load type', () => {
		const out = migrate(v1);
		expect(out.edges[0].type).toBe('load');
	});

	it('preserves an already-current snapshot', () => {
		const current = { version: CURRENT_VERSION, nodes: [], edges: [] };
		expect(migrate(current)).toEqual({ version: CURRENT_VERSION, nodes: [], edges: [] });
	});
});

describe('migrate v2 -> v3', () => {
	const v2 = {
		version: 2,
		nodes: [
			{
				id: 'pool-1',
				type: 'pool',
				position: { x: 0, y: 0 },
				data: { kind: 'pool', label: 'API (pool)' }
			},
			{
				id: 'service-1',
				type: 'service',
				parentId: 'pool-1',
				position: { x: 0, y: 0 },
				data: { kind: 'service', label: 'API', capacity: 750 }
			}
		],
		edges: []
	};

	it('gives the pool a per-replica capacity inherited from its children', () => {
		const out = migrate(v2);
		expect((out.nodes[0].data as { capacity: number }).capacity).toBe(750);
	});

	it('makes replicas non-interactive', () => {
		const out = migrate(v2);
		const child = out.nodes[1] as {
			draggable?: boolean;
			selectable?: boolean;
			connectable?: boolean;
		};
		expect(child.draggable).toBe(false);
		expect(child.selectable).toBe(false);
		expect(child.connectable).toBe(false);
	});
});

describe('migrate v4 -> v5', () => {
	const v4 = {
		version: 4,
		nodes: [
			{
				id: 'database-1',
				type: 'database',
				position: { x: 0, y: 0 },
				data: {
					kind: 'database',
					label: 'PG',
					engine: 'postgres',
					persistent: true,
					capacity: 1000
				}
			},
			{
				id: 'service-1',
				type: 'service',
				position: { x: 0, y: 0 },
				data: { kind: 'service', label: 'API', capacity: 500, version: 1 }
			}
		],
		edges: []
	};

	it('backfills database scaling fields with single-mode defaults', () => {
		const out = migrate(v4);
		const db = out.nodes[0].data as {
			mode: string;
			replicaCount: number;
			readRatio: number;
			shardCount: number;
			skew: number;
		};
		expect(out.version).toBe(CURRENT_VERSION);
		expect(db.mode).toBe('single');
		expect(db.replicaCount).toBe(2);
		expect(db.readRatio).toBe(0.8);
		expect(db.shardCount).toBe(2);
		expect(db.skew).toBe(0);
	});

	it('leaves non-database nodes untouched', () => {
		const out = migrate(v4);
		expect(out.nodes[1].data).not.toHaveProperty('mode');
	});
});
