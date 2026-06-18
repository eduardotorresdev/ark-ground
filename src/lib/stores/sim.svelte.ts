import { graph } from './graph.svelte';
import { bucket, computeSim, type Level, type NodeStat, type SimResult } from '$lib/sim/engine';

type Disp = { offered: number; served: number };

/**
 * Always-on load simulation. `result` is the steady-state target, recomputed
 * reactively whenever the graph changes; `disp` holds per-node values that ramp
 * toward the target each animation frame, giving the continuous-time feel.
 */
class SimStore {
	#result = $derived.by<SimResult>(() => computeSim(graph.nodes, graph.edges));
	disp = $state<Record<string, Disp>>({});
	#raf = 0;

	get result(): SimResult {
		return this.#result;
	}

	nodeStat(id: string): NodeStat | undefined {
		return this.#result.nodes[id];
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
		if (t.capacity == null) return t.level; // sources keep their static level
		const util = t.capacity > 0 ? this.dispOf(id).offered / t.capacity : 0;
		return bucket(util);
	}

	start(): () => void {
		const tick = () => {
			const targets = this.#result.nodes;
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

/** Exponential approach toward the target; snaps when close enough. */
function lerp(from: number, to: number): number {
	const next = from + (to - from) * 0.12;
	return Math.abs(to - next) < 0.25 ? to : next;
}

export const sim = new SimStore();
