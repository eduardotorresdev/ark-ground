import { describe, it, expect } from 'vitest';
import { computeSim, bucket } from './engine';
import type { ArchNode, DatabaseData } from '$lib/registry/types';
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
	data: { kind: 'service', label: id, capacity, version: 1 },
	...(parentId ? { parentId, extent: 'parent' as const } : {})
});
const database = (id: string, capacity: number, scaling?: Partial<DatabaseData>): ArchNode => ({
	id,
	type: 'database',
	position: at,
	data: { kind: 'database', label: id, engine: 'postgres', persistent: true, capacity, ...scaling }
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
	data: { kind: 'pool', label: id, capacity: 500, version: 1 }
});
const gateway = (id: string, weights?: Record<string, number>): ArchNode => ({
	id,
	type: 'api-gateway',
	position: at,
	data: { kind: 'api-gateway', label: id, capacity: 100000, weights }
});
const broker = (
	id: string,
	mode: 'topic' | 'work-queue' = 'work-queue',
	fullPolicy: 'drop' | 'backpressure' = 'drop'
): ArchNode => ({
	id,
	type: 'broker',
	position: at,
	data: { kind: 'broker', label: id, mode, bufferSize: 10000, maxDeliveryRate: 10000, fullPolicy }
});
const edge = (source: string, target: string): Edge => ({
	id: `${source}->${target}`,
	source,
	target
});
const monolith = (id: string, capacity: number): ArchNode => ({
	id,
	type: 'monolith',
	position: at,
	data: { kind: 'monolith', label: id, capacity, version: 1, modules: [] }
});
/** An edge carrying a call-amplification factor (N downstream calls per request). */
const ampEdge = (source: string, target: string, amplification: number): Edge => ({
	id: `${source}->${target}`,
	source,
	target,
	data: { amplification }
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

describe('api gateway routing', () => {
	it('splits load across targets proportionally to their weights', () => {
		const nodes = [
			load('g', 300),
			gateway('gw', { post: 75, users: 25 }),
			service('post', 5000),
			service('users', 5000)
		];
		const edges = [edge('g', 'gw'), edge('gw', 'post'), edge('gw', 'users')];
		const { nodes: stat, edges: estat } = computeSim(nodes, edges);

		// 300 rps split 75/25 -> 225 / 75 (routed, not broadcast).
		expect(stat.post.offered).toBe(225);
		expect(stat.users.offered).toBe(75);
		expect(estat['gw->post'].load).toBe(225);
		expect(estat['gw->users'].load).toBe(75);
	});

	it('splits evenly when no weights are configured', () => {
		const nodes = [load('g', 300), gateway('gw'), service('a', 5000), service('b', 5000)];
		const edges = [edge('g', 'gw'), edge('gw', 'a'), edge('gw', 'b')];
		const { nodes: stat } = computeSim(nodes, edges);
		expect(stat.a.offered).toBe(150);
		expect(stat.b.offered).toBe(150);
	});
});

describe('broker', () => {
	it('work-queue: drains at the sum of consumer capacities, decoupled from publish', () => {
		const nodes = [load('g', 1000), broker('mq'), service('a', 300), service('b', 300)];
		const edges = [edge('g', 'mq'), edge('mq', 'a'), edge('mq', 'b')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.mq.offered).toBe(1000); // accepts the full publish rate
		expect(stat.mq.served).toBe(600); // delivers only what the consumers drain
		expect(stat.mq.broker?.mode).toBe('work-queue');
		expect(stat.a.offered).toBe(300);
		expect(stat.b.offered).toBe(300);
	});

	it('topic: fans out the full publish rate to every consumer', () => {
		const nodes = [
			load('g', 1000),
			broker('mq', 'topic'),
			service('fast', 2000),
			service('slow', 300)
		];
		const edges = [edge('g', 'mq'), edge('mq', 'fast'), edge('mq', 'slow')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.fast.offered).toBe(1000); // fast keeps up
		expect(stat.slow.offered).toBe(300); // slow is capped at its capacity
		expect(stat.slow.dropped).toBe(0); // excess queues as backlog, not consumer drops
	});

	it('drops the overflow at the broker once the buffer is full', () => {
		const nodes = [load('g', 1000), broker('mq'), service('a', 300), service('b', 300)];
		const edges = [edge('g', 'mq'), edge('mq', 'a'), edge('mq', 'b')];
		const brokerState = { mq: { backlog: { __shared__: 10000 } } };
		const { nodes: stat } = computeSim(nodes, edges, {}, brokerState);

		expect(stat.mq.dropped).toBe(400); // publish 1000 − drain 600
		expect(stat.mq.level).toBe('crit');
	});

	it('backpressure charges the refused rate back to the producer', () => {
		const nodes = [
			load('g', 1000),
			service('p', 5000),
			broker('mq', 'work-queue', 'backpressure'),
			service('c', 300)
		];
		const edges = [edge('g', 'p'), edge('p', 'mq'), edge('mq', 'c')];
		const brokerState = { mq: { backlog: { __shared__: 10000 } } };
		const { nodes: stat } = computeSim(nodes, edges, {}, brokerState);

		expect(stat.mq.broker?.blocked).toBe(700); // publish 1000 − drain 300
		expect(stat.p.blocked).toBe(700); // attributed to the producer
		expect(stat.p.level).toBe('crit');
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

	it('keeps a cyclic chain finite (gate stays 1 through the cycle)', () => {
		const nodes = [load('g', 200), service('a', 500), service('b', 500)];
		const edges = [edge('g', 'a'), edge('a', 'b'), edge('b', 'a')];
		const { nodes: stat } = computeSim(nodes, edges);
		expect(Number.isFinite(stat.a.served)).toBe(true);
		expect(Number.isFinite(stat.b.served)).toBe(true);
	});
});

describe('synchronous service-to-service backpressure', () => {
	it('cascades upstream: a saturated leaf throttles the whole chain', () => {
		// A → B → C, C is the bottleneck (cap 300). Its saturation gates B and A.
		const nodes = [load('g', 1000), service('a', 1000), service('b', 1000), service('c', 300)];
		const edges = [edge('g', 'a'), edge('a', 'b'), edge('b', 'c')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.c.served).toBe(300);
		expect(stat.c.dropped).toBe(700);
		// B's own capacity is 1000, yet it can only *complete* 300 because C gates it.
		expect(stat.b.served).toBe(300);
		expect(stat.b.blocked).toBe(700);
		expect(stat.b.level).toBe('crit');
		// The gate reaches all the way to A.
		expect(stat.a.served).toBe(300);
		expect(stat.a.blocked).toBe(700);
		expect(stat.a.level).toBe('crit');
	});

	it('regression: without the saturated callee, the caller is not gated', () => {
		const nodes = [load('g', 1000), service('a', 1000), service('b', 1000)];
		const edges = [edge('g', 'a'), edge('a', 'b')];
		const { nodes: stat } = computeSim(nodes, edges);
		expect(stat.b.served).toBe(1000);
		expect(stat.a.served).toBe(1000);
		expect(stat.a.blocked ?? 0).toBe(0);
	});

	it('branching: the caller is gated by its slowest callee (min)', () => {
		// A fans out to B (fast) and C (slow). A awaits both, so C's 0.4 fraction wins.
		const nodes = [load('g', 500), service('a', 5000), service('b', 1000), service('c', 200)];
		const edges = [edge('g', 'a'), edge('a', 'b'), edge('a', 'c')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.c.served).toBe(200); // 500 offered, cap 200
		expect(stat.b.served).toBe(500); // keeps up
		expect(stat.a.served).toBe(200); // gated by C: 500 · min(1, 0.4)
		expect(stat.a.level).toBe('crit');
	});

	it('amplification: one request generates N downstream calls', () => {
		// A serves 100, each request makes 5 calls to B → B is offered 500.
		const nodes = [load('g', 100), service('a', 1000), service('b', 300)];
		const edges = [edge('g', 'a'), ampEdge('a', 'b', 5)];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.b.offered).toBe(500);
		expect(stat.b.served).toBe(300);
		expect(stat.b.dropped).toBe(200);
		// B completes 0.6 of its load, gating A: 100 · 0.6.
		expect(stat.a.served).toBe(60);
		expect(stat.a.blocked).toBe(40);
	});

	it('works through a monolith callee (service ↔ monolith)', () => {
		const nodes = [load('g', 800), service('a', 2000), monolith('m', 300)];
		const edges = [edge('g', 'a'), edge('a', 'm')];
		const { nodes: stat } = computeSim(nodes, edges);
		expect(stat.m.served).toBe(300);
		expect(stat.a.served).toBe(300); // gated by the monolith
		expect(stat.a.level).toBe('crit');
	});

	it('exposes a sync drain capacity for the temporal queue', () => {
		const nodes = [load('g', 1000), service('a', 1000), service('c', 300)];
		const edges = [edge('g', 'a'), edge('a', 'c')];
		const { nodes: stat } = computeSim(nodes, edges);
		// C drains at its full capacity; A's drain is gated to C's throughput.
		expect(stat.c.sync?.drainCap).toBe(300);
		expect(stat.a.sync?.drainCap).toBeCloseTo(300, 5); // 1000 · gate 0.3
	});
});

describe('broker edges do NOT cascade (async contrast)', () => {
	it('a slow consumer behind a broker never gates the producer', () => {
		const nodes = [load('g', 1000), service('p', 5000), broker('mq'), service('c', 300)];
		const edges = [edge('g', 'p'), edge('p', 'mq'), edge('mq', 'c')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.p.served).toBe(1000); // publisher unaffected — the broker decouples
		expect(stat.p.blocked ?? 0).toBe(0); // not gated by the slow consumer
		expect(stat.p.sync?.queue).toBe(0); // no in-flight backlog builds on the producer
	});
});

describe('multiple independent databases', () => {
	it('tracks each database in isolation, with no shared limit', () => {
		const nodes = [
			load('g1', 300),
			service('s1', 1000),
			database('dbA', 5000),
			load('g2', 200),
			service('s2', 1000),
			database('dbB', 5000)
		];
		const edges = [edge('g1', 's1'), edge('s1', 'dbA'), edge('g2', 's2'), edge('s2', 'dbB')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.dbA.offered).toBe(300);
		expect(stat.dbA.served).toBe(300);
		expect(stat.dbB.offered).toBe(200);
		expect(stat.dbB.served).toBe(200);
	});

	it('a saturated database back-pressures only its own caller, not other DBs', () => {
		// Pair 1: dbA is the bottleneck (cap 300) and gates s1.
		// Pair 2: fully healthy and must stay untouched.
		const nodes = [
			load('g1', 1000),
			service('s1', 5000),
			database('dbA', 300),
			load('g2', 100),
			service('s2', 5000),
			database('dbB', 5000)
		];
		const edges = [edge('g1', 's1'), edge('s1', 'dbA'), edge('g2', 's2'), edge('s2', 'dbB')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.dbA.served).toBe(300);
		expect(stat.s1.served).toBe(300); // gated by dbA
		expect(stat.s1.level).toBe('crit');
		// The other pair is wholly independent — no leakage.
		expect(stat.dbB.offered).toBe(100);
		expect(stat.dbB.served).toBe(100);
		expect(stat.s2.served).toBe(100);
		expect(stat.s2.blocked ?? 0).toBe(0);
		expect(stat.s2.level).not.toBe('crit');
	});
});

describe('database scaling: single / replicas / sharded', () => {
	it('single mode (or absent mode) keeps the legacy capacity', () => {
		const nodes = [load('g', 4000), database('d', 1000)];
		const { nodes: stat } = computeSim(nodes, [edge('g', 'd')]);
		expect(stat.d.capacity).toBe(1000);
		expect(stat.d.served).toBe(1000);
		expect(stat.d.dropped).toBe(3000);
		expect(stat.d.level).toBe('crit');
		expect(stat.d.db?.mode).toBe('single');
	});

	it('replicas: pure reads scale capacity by (replicas + 1)', () => {
		// readRatio 1 ⇒ read pool = primary + 3 replicas = 4 ⇒ Ceff = 4000.
		const nodes = [
			load('g', 2000),
			database('d', 1000, { mode: 'replicas', replicaCount: 3, readRatio: 1 })
		];
		const { nodes: stat } = computeSim(nodes, [edge('g', 'd')]);
		expect(stat.d.capacity).toBe(4000);
		expect(stat.d.served).toBe(2000);
		expect(stat.d.level).toBe('ok'); // 2000 / 4000 = 0.5
		expect(stat.d.db?.reads?.capacity).toBe(4000);
		expect(stat.d.db?.writes?.capacity).toBe(1000);
	});

	it('replicas: writes do not scale — the primary is the bottleneck', () => {
		// readRatio 0.5, R=3 ⇒ Ceff = cap / max(0.5/4, 0.5) = 1000 / 0.5 = 2000.
		const db = database('d', 1000, { mode: 'replicas', replicaCount: 3, readRatio: 0.5 });
		const nodes = [load('g', 4000), db];
		const { nodes: stat } = computeSim(nodes, [edge('g', 'd')]);
		expect(stat.d.capacity).toBe(2000);
		// 4000 offered ⇒ 2000 writes vs 1000 write capacity ⇒ saturated.
		expect(stat.d.level).toBe('crit');
		expect(stat.d.dropped).toBe(2000);
		// replication lag appears once the primary's write path fills.
		expect(stat.d.db?.replicationLagSeconds ?? 0).toBeGreaterThan(0);
	});

	it('sharded: capacity scales by shard count when load is uniform', () => {
		const nodes = [
			load('g', 2000),
			database('d', 1000, { mode: 'sharded', shardCount: 4, skew: 0 })
		];
		const { nodes: stat } = computeSim(nodes, [edge('g', 'd')]);
		expect(stat.d.capacity).toBe(4000);
		expect(stat.d.served).toBe(2000);
		expect(stat.d.level).toBe('ok'); // 2000 / 4000 = 0.5
		expect(stat.d.db?.units).toHaveLength(4);
		// uniform ⇒ no hot shard
		expect(stat.d.db?.units.every((u) => !u.hot)).toBe(true);
	});

	it('sharded skew collapses effective capacity toward a single hot shard', () => {
		// skew 1 ⇒ hotShare 1 ⇒ Ceff = cap = 1000, while cold shards sit idle.
		const nodes = [
			load('g', 3000),
			database('d', 1000, { mode: 'sharded', shardCount: 4, skew: 1 })
		];
		const { nodes: stat } = computeSim(nodes, [edge('g', 'd')]);
		expect(stat.d.capacity).toBe(1000);
		expect(stat.d.level).toBe('crit');
		const units = stat.d.db?.units ?? [];
		expect(units[0].hot).toBe(true);
		expect(units[0].level).toBe('crit'); // hot shard saturated
		expect(bucket(units[1].util)).toBe('idle'); // cold shards idle
	});

	it('a replica-saturated database still gates its caller in cascade', () => {
		// Write-bound database (readRatio 0) ⇒ Ceff = 500 ⇒ gates the service.
		const nodes = [
			load('g', 2000),
			service('s', 5000),
			database('d', 500, { mode: 'replicas', replicaCount: 4, readRatio: 0 })
		];
		const { nodes: stat } = computeSim(nodes, [edge('g', 's'), edge('s', 'd')]);
		expect(stat.d.capacity).toBe(500);
		expect(stat.d.served).toBe(500);
		expect(stat.s.served).toBe(500); // gated by the saturated primary
		expect(stat.s.level).toBe('crit');
	});
});

describe('cache', () => {
	const cache = (id: string, capacity: number, hitRatio: number, ttlSeconds = 0): ArchNode => ({
		id,
		type: 'cache',
		position: at,
		data: { kind: 'cache', label: id, capacity, hitRatio, ttlSeconds }
	});

	it('serves the hit fraction locally and forwards only misses downstream', () => {
		const nodes = [load('g', 1000), cache('c', 100000, 0.8), database('d', 5000)];
		const edges = [edge('g', 'c'), edge('c', 'd')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.c.served).toBe(1000);
		expect(stat.c.cache?.hits).toBeCloseTo(800, 5);
		expect(stat.c.cache?.misses).toBeCloseTo(200, 5);
		expect(stat.c.cache?.hitRatio).toBeCloseTo(0.8, 5);
		// the backing only sees the misses → its offered load drops by the hit ratio
		expect(stat.d.offered).toBeCloseTo(200, 5);
		expect(stat.d.served).toBeCloseTo(200, 5);
	});

	it('saturates on its own capacity under high load', () => {
		const nodes = [load('g', 1000), cache('c', 400, 0.8), database('d', 5000)];
		const edges = [edge('g', 'c'), edge('c', 'd')];
		const { nodes: stat } = computeSim(nodes, edges);

		expect(stat.c.served).toBe(400);
		expect(stat.c.dropped).toBe(600);
		expect(stat.c.level).toBe('crit');
		// only the misses of the served load reach the backing: 400 · (1 − 0.8)
		expect(stat.d.offered).toBeCloseTo(80, 5);
	});

	it('shields hits when the backing saturates — only misses are throttled', () => {
		const nodes = [load('g', 1000), cache('c', 100000, 0.8), database('d', 50)];
		const edges = [edge('g', 'c'), edge('c', 'd')];
		const { nodes: stat } = computeSim(nodes, edges);

		// backing is overwhelmed by the 200 req/s of misses, serves only 50
		expect(stat.d.offered).toBeCloseTo(200, 5);
		expect(stat.d.served).toBe(50);
		// hits (800) all pass; of the 200 misses only 50 complete → served ≈ 850
		expect(stat.c.cache?.hits).toBeCloseTo(800, 5);
		expect(stat.c.served).toBeCloseTo(850, 5);
		expect(stat.c.blocked ?? 0).toBeCloseTo(150, 5);
		expect(stat.c.level).toBe('crit');
	});

	it('modulates the effective hit ratio by warmth from the cache state', () => {
		const nodes = [load('g', 1000), cache('c', 100000, 0.8, 30), database('d', 5000)];
		const edges = [edge('g', 'c'), edge('c', 'd')];

		// half-warm: effective hit = 0.8 · 0.5 · retention(30) = 0.8 · 0.5 · 30/35
		const effHit = 0.8 * 0.5 * (30 / 35);
		const warm = computeSim(nodes, edges, {}, {}, {}, { c: { warmth: 0.5 } }).nodes;
		expect(warm.c.cache?.hitRatio).toBeCloseTo(effHit, 5);
		expect(warm.d.offered).toBeCloseTo(1000 * (1 - effHit), 5);

		// cold start (no state, ttl > 0): warmth 0 → no hits, everything forwarded
		const cold = computeSim(nodes, edges).nodes;
		expect(cold.c.cache?.warmth).toBe(0);
		expect(cold.c.cache?.hits).toBe(0);
		expect(cold.d.offered).toBeCloseTo(1000, 5);
	});

	it('TTL expiry erodes the steady-state hit ratio even when fully warm', () => {
		// fully warm cache, ttl 10s → retention = 10/(10+5) = 0.6667
		// effective hit = 0.8 · 1 · 0.6667 = 0.5333 → backing sees the rest re-fetched
		const nodes = [load('g', 1000), cache('c', 100000, 0.8, 10), database('d', 5000)];
		const edges = [edge('g', 'c'), edge('c', 'd')];
		const warm = computeSim(nodes, edges, {}, {}, {}, { c: { warmth: 1 } }).nodes;

		expect(warm.c.cache?.ttlRetention).toBeCloseTo(10 / 15, 4);
		expect(warm.c.cache?.hitRatio).toBeCloseTo(0.8 * (10 / 15), 4);
		expect(warm.d.offered).toBeCloseTo(1000 * (1 - 0.8 * (10 / 15)), 1);
	});

	it('a longer TTL keeps data cached longer → more hits, fewer re-fetches', () => {
		const backing = (ttl: number) =>
			computeSim(
				[load('g', 1000), cache('c', 1e9, 0.8, ttl), database('d', 1e9)],
				[edge('g', 'c'), edge('c', 'd')],
				{},
				{},
				{},
				{ c: { warmth: 1 } }
			).nodes;

		const short = backing(5);
		const long = backing(300);
		// longer TTL → higher effective hit ratio → less load reaching the source
		expect(long.c.cache!.hitRatio).toBeGreaterThan(short.c.cache!.hitRatio);
		expect(long.d.offered).toBeLessThan(short.d.offered);
		// a very long TTL approaches the configured ceiling (0.8)
		expect(backing(1e7).c.cache!.hitRatio).toBeCloseTo(0.8, 2);
	});
});
