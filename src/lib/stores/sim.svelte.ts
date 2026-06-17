/** Placeholder for the future load-simulation engine. */
class SimStore {
	running = $state(false);
	/** example requests/second the simulation would push through the graph */
	rps = $state(100);

	toggle() {
		this.running = !this.running;
	}
}

export const sim = new SimStore();
