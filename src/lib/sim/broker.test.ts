import { describe, it, expect } from 'vitest';
import { deliver, advance, type BrokerInputs, type BrokerRuntime } from './broker';

const SHARED = '__shared__';

const inputs = (over: Partial<BrokerInputs> = {}): BrokerInputs => ({
	mode: 'work-queue',
	bufferSize: 10000,
	maxDeliveryRate: 10000,
	fullPolicy: 'drop',
	publishRate: 1000,
	consumers: [
		{ edgeId: 'e1', consumerId: 'a', capacity: 300 },
		{ edgeId: 'e2', consumerId: 'b', capacity: 300 }
	],
	...over
});

const state = (backlog: Record<string, number>): BrokerRuntime => ({ backlog });

describe('broker deliver — work-queue', () => {
	it('drains at sum of capacities and splits by capacity when caught up', () => {
		const { deliveryByEdge, stat } = deliver(inputs(), undefined);
		// totalDrain = min(10000, 600) = 600; nothing queued, publish 1000 capped at 600.
		expect(stat.deliveryRate).toBe(600);
		expect(deliveryByEdge.e1).toBe(300);
		expect(deliveryByEdge.e2).toBe(300);
		expect(stat.dropped).toBe(0);
		expect(stat.backlog).toBe(0);
		expect(stat.fill).toBe(0);
	});

	it('drops the overflow once the buffer is full (drop policy)', () => {
		const { stat } = deliver(inputs(), state({ [SHARED]: 10000 }));
		expect(stat.deliveryRate).toBe(600);
		expect(stat.dropped).toBe(400); // publish 1000 − drain 600
		expect(stat.blocked).toBe(0);
		expect(stat.fill).toBe(1);
	});

	it('charges the overflow as backpressure instead of dropping it', () => {
		const { stat } = deliver(inputs({ fullPolicy: 'backpressure' }), state({ [SHARED]: 10000 }));
		expect(stat.blocked).toBe(400);
		expect(stat.dropped).toBe(0);
	});

	it('is capped by maxDeliveryRate below the consumers capacity', () => {
		const { stat } = deliver(inputs({ maxDeliveryRate: 500 }), state({ [SHARED]: 10000 }));
		// min(500, 600) = 500; overflow = 1000 − 500.
		expect(stat.deliveryRate).toBe(500);
		expect(stat.dropped).toBe(500);
	});
});

describe('broker deliver — topic (per-consumer)', () => {
	const topic = inputs({
		mode: 'topic',
		consumers: [
			{ edgeId: 'fast', consumerId: 'f', capacity: 2000 },
			{ edgeId: 'slow', consumerId: 's', capacity: 300 }
		]
	});

	it('fans out: a fast consumer keeps up, a slow one lags behind', () => {
		// Slow consumer already 700 behind; fast caught up.
		const { deliveryByEdge, stat } = deliver(topic, state({ slow: 700 }));
		expect(deliveryByEdge.fast).toBe(1000); // min(publish, drainCap 2000), backlog 0
		expect(deliveryByEdge.slow).toBe(300); // queued → drains at its own cap
		const slow = stat.perConsumer.find((c) => c.edgeId === 'slow')!;
		expect(slow.backlog).toBe(700);
		expect(slow.lagSeconds).toBeCloseTo(700 / 300, 5);
		// Headline = the laggiest consumer.
		expect(stat.backlog).toBe(700);
	});
});

describe('broker advance — backlog integration', () => {
	it('topic: each consumer accumulates its own backlog over dt', () => {
		const topic = inputs({
			mode: 'topic',
			consumers: [
				{ edgeId: 'fast', consumerId: 'f', capacity: 2000 },
				{ edgeId: 'slow', consumerId: 's', capacity: 300 }
			]
		});
		const { stat } = deliver(topic, undefined);
		const next = advance(stat, undefined, 1); // 1 second
		expect(next.backlog.fast).toBe(0); // 0 + (1000 − 2000) clamped at 0
		expect(next.backlog.slow).toBe(700); // 0 + (1000 − 300)
	});

	it('work-queue: shared backlog grows at publish − totalDrain', () => {
		const { stat } = deliver(inputs(), undefined);
		const next = advance(stat, undefined, 1);
		expect(next.backlog[SHARED]).toBe(400); // 1000 − 600
	});

	it('drains back down when production falls below consumption', () => {
		const { stat } = deliver(inputs({ publishRate: 100 }), state({ [SHARED]: 500 }));
		const next = advance(stat, state({ [SHARED]: 500 }), 1);
		expect(next.backlog[SHARED]).toBe(0); // 500 + (100 − 600), clamped at 0
	});

	it('clamps the backlog at bufferSize', () => {
		const { stat } = deliver(inputs({ bufferSize: 500 }), state({ [SHARED]: 400 }));
		const next = advance(stat, state({ [SHARED]: 400 }), 1);
		expect(next.backlog[SHARED]).toBe(500); // 400 + 400 = 800, clamped at 500
	});
});
