import { migrate } from '$lib/persistence/migrate';
import { graph } from '$lib/stores/graph.svelte';
import { validateGraph } from './validate';
import { autoLayout } from './layout';
import { getFlow } from './flow-bridge';
import type { Preset } from './types';

export type ApplyMode = 'merge' | 'replace';
export type ApplyOptions = { mode?: ApplyMode };
export type ApplyResult = { warnings: string[] };

/**
 * Inject a preset recipe into the canvas. The inner graph is migrated to the
 * current schema, validated/repaired against the registry and port rules, and
 * given a fallback layout for any missing positions. `merge` (default) adds it
 * beside the current graph with remapped ids; `replace` swaps the canvas and
 * restores the saved viewport (or fits the view). Returns repair warnings.
 */
export function applyPreset(preset: Preset, opts: ApplyOptions = {}): ApplyResult {
	const mode = opts.mode ?? 'merge';
	const migrated = migrate(preset.graph);
	const { nodes, edges, warnings } = validateGraph(migrated);
	const laid = autoLayout({ version: migrated.version, nodes, edges });
	const flow = getFlow();

	if (mode === 'replace') {
		graph.load({ nodes: laid.nodes, edges: laid.edges });
		if (preset.viewport && flow?.setViewport) flow.setViewport(preset.viewport);
		else setTimeout(() => flow?.fitView?.(), 0);
	} else {
		graph.merge({ nodes: laid.nodes, edges: laid.edges });
		setTimeout(() => flow?.fitView?.(), 0);
	}

	if (warnings.length) console.warn('[preset] reparos aplicados:', warnings);
	return { warnings };
}
