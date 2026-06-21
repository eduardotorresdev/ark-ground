import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/svelte';
import {
	advanceQueue,
	amplificationOf,
	isSyncKind,
	queueStat,
	sameQueues,
	type SyncRuntime
} from './syncqueue';

const edge = (data?: Record<string, unknown>): Edge => ({
	id: 'a->b',
	source: 'a',
	target: 'b',
	data
});

describe('advanceQueue — backlog integration', () => {
	it('grows at offered − drainCap over dt', () => {
		// offered 1000, drainCap 300 → +700/s
		expect(advanceQueue(1000, 300, 9000, undefined, 1).queue).toBe(700);
		expect(advanceQueue(1000, 300, 9000, { queue: 700 }, 1).queue).toBe(1400);
	});

	it('drains with spare capacity once the load subsides', () => {
		// offered 100, drainCap 300 → −200/s from a backlog of 500
		expect(advanceQueue(100, 300, 9000, { queue: 500 }, 1).queue).toBe(300);
	});

	it('clamps at 0 (never negative)', () => {
		expect(advanceQueue(0, 300, 9000, { queue: 100 }, 1).queue).toBe(0);
	});

	it('clamps at qMax', () => {
		// 8000 + (5000 − 0)·1 = 13000, clamped at 9000
		expect(advanceQueue(5000, 0, 9000, { queue: 8000 }, 1).queue).toBe(9000);
	});
});

describe('queueStat — display metrics', () => {
	it('reports latency = queue / drainCap (Little)', () => {
		const s = queueStat(600, 300, 9000);
		expect(s.latencySeconds).toBeCloseTo(2, 5);
		expect(s.fill).toBeCloseTo(600 / 9000, 5);
		expect(s.queue).toBe(600);
		expect(s.drainCap).toBe(300);
	});

	it('is zero-latency when empty', () => {
		expect(queueStat(0, 300, 9000).latencySeconds).toBe(0);
	});

	it('reports infinite latency when stalled with a backlog', () => {
		expect(queueStat(500, 0, 9000).latencySeconds).toBe(Infinity);
	});
});

describe('amplificationOf', () => {
	it('defaults to 1 when absent or malformed', () => {
		expect(amplificationOf(edge())).toBe(1);
		expect(amplificationOf(edge({}))).toBe(1);
		expect(amplificationOf(edge({ amplification: NaN }))).toBe(1);
	});

	it('rounds to an integer ≥ 1', () => {
		expect(amplificationOf(edge({ amplification: 3 }))).toBe(3);
		expect(amplificationOf(edge({ amplification: 2.4 }))).toBe(2);
		expect(amplificationOf(edge({ amplification: 0 }))).toBe(1);
		expect(amplificationOf(edge({ amplification: -5 }))).toBe(1);
	});
});

describe('isSyncKind', () => {
	it('includes synchronous callees and routers', () => {
		for (const k of [
			'service',
			'monolith',
			'database',
			'pool',
			'api-gateway',
			'load-balancer'
		] as const)
			expect(isSyncKind(k)).toBe(true);
	});

	it('excludes the async broker and pure sources', () => {
		expect(isSyncKind('broker')).toBe(false);
		expect(isSyncKind('load')).toBe(false);
	});
});

describe('sameQueues', () => {
	it('detects equal maps within tolerance', () => {
		const a: Record<string, SyncRuntime> = { s: { queue: 100 } };
		expect(sameQueues(a, { s: { queue: 100.4 } })).toBe(true);
		expect(sameQueues(a, { s: { queue: 200 } })).toBe(false);
		expect(sameQueues(a, {})).toBe(false);
	});
});
