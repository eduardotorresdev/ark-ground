import type { BrokerFullPolicy, BrokerMode } from '$lib/registry/types';

/**
 * Broker / queue simulation — the only *stateful* node.
 *
 * `computeSim` is steady-state and stateless; a broker, by contrast, accumulates
 * a backlog over time. We split the concern in two pure functions:
 *  - `deliver(inputs, state)` — given the *current* backlog snapshot, the
 *    instantaneous per-consumer delivery rate, drops, backpressure and lag. Used
 *    by `computeSim` to set edge flow and node stats this frame.
 *  - `advance(inputs, state, dt)` — integrate the backlog forward by `dt`
 *    seconds. Called once per animation frame by the sim store.
 *
 * Backlog is a *count* of quanta (messages); rates are req/s. A backlog drained
 * at `D` req/s represents `backlog / D` seconds of lag.
 *
 * Drain rule: each delivery stream drains at `min(maxDeliveryRate, consumerCap)`.
 * The broker reads the consumer's *static* capacity (ignoring other load on it) —
 * a deliberate simplification. For `broker → load-balancer → pool` the immediate
 * consumer is the LB (near-infinite passthrough), so the pool, not the broker,
 * absorbs the excess; good enough for the teaching model.
 */

const SHARED = '__shared__';
const EPS = 1e-6;

/** A downstream consumer the broker feeds, with its static serve capacity. */
export type BrokerConsumer = { edgeId: string; consumerId: string; capacity: number };

/** Everything `deliver`/`advance` need that comes from the graph this frame. */
export type BrokerInputs = {
	mode: BrokerMode;
	bufferSize: number;
	maxDeliveryRate: number;
	fullPolicy: BrokerFullPolicy;
	/** total req/s arriving from producers */
	publishRate: number;
	consumers: BrokerConsumer[];
};

/** Per-consumer breakdown for display (the Inspector lists these in topic mode). */
export type BrokerConsumerStat = {
	edgeId: string;
	consumerId: string;
	/** queued quanta waiting for this consumer */
	backlog: number;
	/** req/s this consumer can drain = min(maxDeliveryRate, capacity) */
	drainCap: number;
	/** backlog / drainCap, in seconds */
	lagSeconds: number;
};

/**
 * Steady-state stats for a broker node, plus the inputs (so the sim store can
 * `advance` the backlog without re-deriving them from the graph).
 */
export type BrokerStat = BrokerInputs & {
	/** headline backlog: the laggiest consumer (topic) or the shared queue (work-queue) */
	backlog: number;
	/** backlog / bufferSize, in [0, 1] */
	fill: number;
	/** headline lag in seconds */
	lagSeconds: number;
	/** total req/s delivered downstream */
	deliveryRate: number;
	/** req/s lost because the buffer is full (drop policy) */
	dropped: number;
	/** req/s refused back to producers because the buffer is full (backpressure) */
	blocked: number;
	perConsumer: BrokerConsumerStat[];
};

/** Persisted backlog between frames: queued quanta keyed by stream. */
export type BrokerRuntime = { backlog: Record<string, number> };

/** Per-consumer drain ceiling. */
function drainCapOf(maxDeliveryRate: number, capacity: number): number {
	return Math.max(0, Math.min(maxDeliveryRate, capacity));
}

function lag(backlog: number, drainCap: number): number {
	if (backlog <= EPS) return 0;
	return drainCap > 0 ? backlog / drainCap : Infinity;
}

/**
 * Instantaneous delivery given the current backlog `state`. Pure — does not
 * mutate state. Returns the per-edge delivery rate plus stats for display.
 */
export function deliver(
	inputs: BrokerInputs,
	state: BrokerRuntime | undefined
): {
	deliveryByEdge: Record<string, number>;
	stat: BrokerStat;
} {
	const backlog = state?.backlog ?? {};
	const deliveryByEdge: Record<string, number> = {};
	const perConsumer: BrokerConsumerStat[] = [];
	const { mode, bufferSize, maxDeliveryRate, fullPolicy, publishRate, consumers } = inputs;

	let deliveryRate = 0;
	let dropped = 0;
	let blocked = 0;
	let headBacklog = 0;
	let headLag = 0;

	if (mode === 'topic') {
		// Fan-out: every consumer is an independent stream receiving the full
		// publish rate, with its own backlog/offset.
		for (const c of consumers) {
			const drainCap = drainCapOf(maxDeliveryRate, c.capacity);
			const b = backlog[c.edgeId] ?? 0;
			// Drain at full capacity while queued; otherwise only what arrives.
			const delivery = b > EPS ? drainCap : Math.min(publishRate, drainCap);
			deliveryByEdge[c.edgeId] = delivery;
			deliveryRate += delivery;

			// Overflow only matters once the stream's buffer is full.
			const overflow = b >= bufferSize - EPS ? Math.max(0, publishRate - drainCap) : 0;
			if (fullPolicy === 'drop') dropped = Math.max(dropped, overflow);
			else blocked = Math.max(blocked, overflow);

			const l = lag(b, drainCap);
			perConsumer.push({
				edgeId: c.edgeId,
				consumerId: c.consumerId,
				backlog: b,
				drainCap,
				lagSeconds: l
			});
			if (b > headBacklog) {
				headBacklog = b;
				headLag = l;
			}
		}
	} else {
		// work-queue: one shared queue, competing consumers split by capacity.
		const sumCap = consumers.reduce((s, c) => s + Math.max(0, c.capacity), 0);
		const totalDrain = Math.max(0, Math.min(maxDeliveryRate, sumCap));
		const b = backlog[SHARED] ?? 0;
		const totalDelivery = b > EPS ? totalDrain : Math.min(publishRate, totalDrain);
		deliveryRate = totalDelivery;
		for (const c of consumers) {
			const drainCap = drainCapOf(maxDeliveryRate, c.capacity);
			const share = sumCap > 0 ? totalDelivery * (Math.max(0, c.capacity) / sumCap) : 0;
			deliveryByEdge[c.edgeId] = share;
			perConsumer.push({
				edgeId: c.edgeId,
				consumerId: c.consumerId,
				backlog: b,
				drainCap,
				lagSeconds: lag(b, totalDrain)
			});
		}
		const overflow = b >= bufferSize - EPS ? Math.max(0, publishRate - totalDrain) : 0;
		if (fullPolicy === 'drop') dropped = overflow;
		else blocked = overflow;
		headBacklog = b;
		headLag = lag(b, totalDrain);
	}

	const fill = bufferSize > 0 ? Math.min(1, headBacklog / bufferSize) : headBacklog > 0 ? 1 : 0;

	return {
		deliveryByEdge,
		stat: {
			...inputs,
			backlog: headBacklog,
			fill,
			lagSeconds: headLag,
			deliveryRate,
			dropped,
			blocked,
			perConsumer
		}
	};
}

/**
 * Integrate the backlog forward by `dt` seconds (explicit Euler). For each
 * stream: `backlog += (publish − drain) · dt`, clamped to `[0, bufferSize]`. The
 * clamp models both policies identically at the buffer level — drop evicts the
 * overflow, backpressure refuses it — they differ only in *who* is charged for
 * the loss (handled in `deliver`/`computeSim`, not here).
 */
export function advance(
	stat: BrokerStat,
	prev: BrokerRuntime | undefined,
	dt: number
): BrokerRuntime {
	const prevBacklog = prev?.backlog ?? {};
	const backlog: Record<string, number> = {};
	const { mode, bufferSize, maxDeliveryRate, publishRate, consumers } = stat;

	if (mode === 'topic') {
		for (const c of consumers) {
			const drainCap = drainCapOf(maxDeliveryRate, c.capacity);
			const b = prevBacklog[c.edgeId] ?? 0;
			backlog[c.edgeId] = clamp(b + (publishRate - drainCap) * dt, bufferSize);
		}
	} else {
		const sumCap = consumers.reduce((s, c) => s + Math.max(0, c.capacity), 0);
		const totalDrain = Math.max(0, Math.min(maxDeliveryRate, sumCap));
		const b = prevBacklog[SHARED] ?? 0;
		backlog[SHARED] = clamp(b + (publishRate - totalDrain) * dt, bufferSize);
	}

	return { backlog };
}

function clamp(v: number, max: number): number {
	if (v < 0) return 0;
	if (v > max) return max;
	return v;
}

/** Shallow-ish equality of two backlog maps, to skip needless recomputes when idle. */
export function sameBacklog(
	a: Record<string, BrokerRuntime>,
	b: Record<string, BrokerRuntime>
): boolean {
	const ak = Object.keys(a);
	const bk = Object.keys(b);
	if (ak.length !== bk.length) return false;
	for (const id of ak) {
		const ab = a[id]?.backlog ?? {};
		const bb = b[id]?.backlog;
		if (!bb) return false;
		const aks = Object.keys(ab);
		if (aks.length !== Object.keys(bb).length) return false;
		for (const k of aks) if (Math.abs((ab[k] ?? 0) - (bb[k] ?? 0)) > 0.5) return false;
	}
	return true;
}
