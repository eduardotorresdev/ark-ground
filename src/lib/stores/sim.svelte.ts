import { graph } from './graph.svelte';
import { deploy } from './deploy.svelte';
import { bucket, computeSim, type Level, type NodeStat, type SimResult } from '$lib/sim/engine';
import { advance, sameBacklog, type BrokerRuntime, type BrokerStat } from '$lib/sim/broker';
import {
	advanceQueue,
	sameQueues,
	MAX_LATENCY_SECONDS,
	type SyncRuntime,
	type SyncStat
} from '$lib/sim/syncqueue';

type Disp = { offered: number; served: number };

/**
 * Always-on load simulation. `result` is the steady-state target, recomputed
 * reactively whenever the graph changes; `disp` holds per-node values that ramp
 * toward the target each animation frame, giving the continuous-time feel.
 *
 * Active deploys inject per-node capacity multipliers (`#capMult`), recomputed
 * each frame, so downtime propagates downstream in real time.
 */
class SimStore {
	#capMult = $state.raw<Record<string, number>>({});
	/** Per-broker backlog, integrated each frame in the tick. */
	#brokerState = $state.raw<Record<string, BrokerRuntime>>({});
	/** Per-node synchronous in-flight queue, integrated each frame in the tick. */
	#syncState = $state.raw<Record<string, SyncRuntime>>({});
	/** Reactive frame clock (performance.now) so deploy progress bars animate. */
	now = $state(0);
	#lastNow = 0;
	#result = $derived.by<SimResult>(() =>
		computeSim(graph.nodes, graph.edges, this.#capMult, this.#brokerState, this.#syncState)
	);
	disp = $state<Record<string, Disp>>({});
	#raf = 0;

	get result(): SimResult {
		return this.#result;
	}

	nodeStat(id: string): NodeStat | undefined {
		return this.#result.nodes[id];
	}

	/** Broker backlog/buffer stats for a node, if it is a broker. */
	brokerStat(id: string): BrokerStat | undefined {
		return this.#result.nodes[id]?.broker;
	}

	/** Synchronous in-flight queue stats for a node, if it is a synchronous callee. */
	syncStat(id: string): SyncStat | undefined {
		return this.#result.nodes[id]?.sync;
	}

	edgeStat(id: string) {
		return this.#result.edges[id];
	}

	/** Animated (ramping) values for a node, falling back to the target. */
	dispOf(id: string): Disp {
		const cur = this.disp[id];
		if (cur) return cur;
		const t = this.#result.nodes[id];
		return t ? { offered: t.offered, served: t.served } : { offered: 0, served: 0 };
	}

	/** Live level for a node, derived from the *animated* utilization so the color ramps too. */
	level(id: string): Level {
		const t = this.#result.nodes[id];
		if (!t) return 'idle';
		// A producer back-pressured by a downstream broker shows as critical.
		if (t.blocked && t.blocked > 0.5) return 'crit';
		if (t.capacity == null) return t.level; // sources & brokers keep their static level
		const util = t.capacity > 0 ? this.dispOf(id).offered / t.capacity : 0;
		return bucket(util);
	}

	start(): () => void {
		const tick = () => {
			const nowMs = performance.now();
			// Seconds since last frame, clamped so a backgrounded tab can't dump a
			// huge backlog jump when it refocuses.
			const dt = this.#lastNow ? Math.min(0.1, (nowMs - this.#lastNow) / 1000) : 0;
			this.#lastNow = nowMs;
			this.now = nowMs;
			// Recompute deploy capacity multipliers; settle finished deploys.
			const mult = deploy.multipliers();
			if (!sameMult(mult, this.#capMult)) this.#capMult = mult;
			deploy.settle(nowMs);

			const targets = this.#result.nodes;

			// Integrate broker backlogs forward by dt using this frame's rates. The
			// resulting state feeds the next computeSim (one-frame lag, invisible at
			// 60fps). Rebuilding the map also prunes removed brokers.
			if (dt > 0) {
				const next: Record<string, BrokerRuntime> = {};
				let hasBroker = false;
				for (const id in targets) {
					const bs = targets[id].broker;
					if (!bs) continue;
					hasBroker = true;
					next[id] = advance(bs, this.#brokerState[id], dt);
				}
				if (
					(hasBroker || Object.keys(this.#brokerState).length) &&
					!sameBacklog(next, this.#brokerState)
				)
					this.#brokerState = next;

				// Integrate synchronous in-flight queues the same way: each callee's
				// backlog grows when its (gated) drain can't keep up with its offered
				// load, and drains otherwise. Unlike the broker, this never feeds back
				// into the rate — it is purely the latency/backlog the engine displays.
				const nextSync: Record<string, SyncRuntime> = {};
				let hasSync = false;
				for (const id in targets) {
					const t = targets[id];
					if (!t.sync || t.capacity == null) continue;
					hasSync = true;
					const qMax = t.capacity * MAX_LATENCY_SECONDS;
					nextSync[id] = advanceQueue(t.offered, t.sync.drainCap, qMax, this.#syncState[id], dt);
				}
				if (
					(hasSync || Object.keys(this.#syncState).length) &&
					!sameQueues(nextSync, this.#syncState)
				)
					this.#syncState = nextSync;
			}
			const next: Record<string, Disp> = {};
			let changed = false;
			for (const id in targets) {
				const t = targets[id];
				const cur = this.disp[id] ?? { offered: 0, served: 0 };
				const offered = lerp(cur.offered, t.offered);
				const served = lerp(cur.served, t.served);
				next[id] = { offered, served };
				if (Math.abs(offered - cur.offered) > 0.25 || Math.abs(served - cur.served) > 0.25)
					changed = true;
			}
			// also dirty if nodes were added/removed
			if (changed || Object.keys(next).length !== Object.keys(this.disp).length) this.disp = next;
			this.#raf = requestAnimationFrame(tick);
		};
		this.#raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(this.#raf);
	}
}

/** Shallow equality for the capacity-multiplier map (avoids needless recompute). */
function sameMult(a: Record<string, number>, b: Record<string, number>): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	return ak.every((k) => a[k] === b[k]);
}

/** Exponential approach toward the target; snaps when close enough. */
function lerp(from: number, to: number): number {
	const next = from + (to - from) * 0.12;
	return Math.abs(to - next) < 0.25 ? to : next;
}

export const sim = new SimStore();
