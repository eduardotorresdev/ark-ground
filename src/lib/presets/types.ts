import type { Snapshot } from '$lib/persistence/migrate';

/** Saved viewport (matches @xyflow/svelte's Viewport). */
export type PresetViewport = { x: number; y: number; zoom: number };

/** The graph payload of a preset — same shape persisted to localStorage. */
export type PresetGraph = Snapshot;

/**
 * A serializable "recipe": a full graph plus authoring metadata and an optional
 * saved viewport. The inner `graph` runs through the same `migrate()` chain as
 * localStorage, so presets stay loadable as the schema evolves.
 */
export type Preset = {
	/** version of this envelope (not the inner graph schema) */
	presetVersion: number;
	meta: {
		id: string;
		name: string;
		description?: string;
	};
	graph: PresetGraph;
	viewport?: PresetViewport;
};

/** Current envelope version. Bump + handle older shapes if the envelope changes. */
export const PRESET_VERSION = 1;
