import type { NodeKind } from '$lib/registry/types';
import type { Edge } from '@xyflow/svelte';

/**
 * Synchronous call queues — the temporal side of service-to-service backpressure.
 *
 * `computeSim` solves the steady-state *rate* of a synchronous chain in one
 * backward pass (a saturated callee gates its caller's throughput this tick — see
 * the gate logic in `engine.ts`). On top of that rate, every synchronous node
 * accumulates an in-flight backlog over time, exactly like the broker's buffer:
 *  - `advanceQueue(...)` integrates one node's backlog forward by `dt` seconds.
 *  - `queueStat(...)` derives the display metrics (latency, fill) from a snapshot.
 *
 * The crucial contrast with the broker: this backlog is purely *observational* —
 * it never feeds back into the admission rate (admission is gated instantaneously
 * by the callee's capacity). The broker's backlog, by contrast, *drives* its drain
 * rate. Same integration shape, opposite role.
 *
 * Backlog is a count of in-flight requests; a backlog cleared at `drainCap` req/s
 * represents `backlog / drainCap` seconds of latency (Little's law).
 */

export const EPS = 1e-6;
/** Latency ceiling, in seconds. Caps the backlog so a backgrounded tab can't run it away. */
export const MAX_LATENCY_SECONDS = 30;

/** Persisted in-flight backlog for one synchronous node, between frames. */
export type SyncRuntime = { queue: number };

/** Per-node synchronous queue stats for display. */
export type SyncStat = {
	/** in-flight backlog (requests), integrated over time */
	queue: number;
	/** req/s this node can actually clear = capacity · downstream gate */
	drainCap: number;
	/** queue / drainCap, in seconds (Little's law) */
	latencySeconds: number;
	/** queue / qMax, in [0, 1] for a fill bar */
	fill: number;
};

/**
 * Kinds that act as *synchronous callees*: being saturated, they hold their
 * caller's capacity and so back-pressure it. Routers (`api-gateway`,
 * `load-balancer`) are included so the gate traverses them up to the producer;
 * their capacity is effectively huge, so their own queue stays ~0. The `broker`
 * is deliberately excluded — it is asynchronous, so publishing to it completes
 * immediately and never gates the producer. `load` is a pure source.
 */
export function isSyncKind(kind: NodeKind): boolean {
	return (
		kind === 'service' ||
		kind === 'monolith' ||
		kind === 'database' ||
		kind === 'pool' ||
		kind === 'api-gateway' ||
		kind === 'load-balancer'
	);
}

/** Per-edge call amplification: 1 upstream request → N downstream calls. Integer ≥ 1, default 1. */
export function amplificationOf(edge: Edge): number {
	const raw = (edge.data as { amplification?: number } | undefined)?.amplification;
	if (raw == null || !Number.isFinite(raw)) return 1;
	return Math.max(1, Math.round(raw));
}

/**
 * Integrate one node's in-flight backlog forward by `dt` seconds (explicit
 * Euler): `queue += (offered − drainCap) · dt`, clamped to `[0, qMax]`. Grows
 * while arrivals outpace the (gated) drain, and drains with spare capacity once
 * the load subsides. Mirrors `broker.advance`.
 */
export function advanceQueue(
	offered: number,
	drainCap: number,
	qMax: number,
	prev: SyncRuntime | undefined,
	dt: number
): SyncRuntime {
	const q = (prev?.queue ?? 0) + (offered - drainCap) * dt;
	return { queue: clamp(q, qMax) };
}

/** Display stats from the current backlog snapshot. Pure — does not mutate. */
export function queueStat(queue: number, drainCap: number, qMax: number): SyncStat {
	const latencySeconds = queue <= EPS ? 0 : drainCap > 0 ? queue / drainCap : Infinity;
	const fill = qMax > 0 ? Math.min(1, queue / qMax) : queue > 0 ? 1 : 0;
	return { queue, drainCap, latencySeconds, fill };
}

function clamp(v: number, max: number): number {
	if (v < 0) return 0;
	if (v > max) return max;
	return v;
}

/** Shallow equality of two queue maps, to skip needless recomputes when idle. */
export function sameQueues(
	a: Record<string, SyncRuntime>,
	b: Record<string, SyncRuntime>
): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	for (const id of ak) {
		const bq = b[id];
		if (!bq) return false;
		if (Math.abs((a[id]?.queue ?? 0) - bq.queue) > 0.5) return false;
	}
	return true;
}
