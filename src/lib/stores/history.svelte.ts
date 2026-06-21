import { graph } from './graph.svelte';

const CAP = 50;
const DEBOUNCE = 300;

/**
 * General undo/redo history for the canvas, based on whole-graph snapshots
 * (the graph is small and fully serializable). Changes are captured
 * automatically via a debounced `$effect`, mirroring the autosave. Undo/redo
 * re-apply a stored snapshot through `graph.load`; the effect then sees the new
 * state equal the recorded `present` and skips re-recording — so no flag or
 * timing trick is needed to avoid self-registration.
 */
class History {
	#past = $state<string[]>([]);
	#future = $state<string[]>([]);
	#present = '';
	#timer: ReturnType<typeof setTimeout> | undefined;

	get canUndo(): boolean {
		return this.#past.length > 0;
	}
	get canRedo(): boolean {
		return this.#future.length > 0;
	}

	#serialize(): string {
		return JSON.stringify({ nodes: graph.nodes, edges: graph.edges });
	}

	#record(snap: string): void {
		if (snap === this.#present) return;
		this.#past.push(this.#present);
		if (this.#past.length > CAP) this.#past.shift();
		this.#present = snap;
		this.#future = [];
	}

	#apply(snap: string): void {
		const { nodes, edges } = JSON.parse(snap);
		graph.load({ nodes, edges });
	}

	/** Begin tracking. Call once on mount (after the saved diagram is loaded). */
	start(): () => void {
		this.#present = this.#serialize();
		const stop = $effect.root(() => {
			$effect(() => {
				const snap = this.#serialize();
				clearTimeout(this.#timer);
				this.#timer = setTimeout(() => this.#record(snap), DEBOUNCE);
			});
		});
		return () => {
			clearTimeout(this.#timer);
			stop();
		};
	}

	undo(): void {
		if (!this.#past.length) return;
		this.#future.unshift(this.#present);
		const prev = this.#past.pop()!;
		this.#present = prev;
		this.#apply(prev);
	}

	redo(): void {
		if (!this.#future.length) return;
		this.#past.push(this.#present);
		const next = this.#future.shift()!;
		this.#present = next;
		this.#apply(next);
	}
}

export const history = new History();
export const startHistory = (): (() => void) => history.start();
