import { applyPreset } from './apply';
import { validateGraph } from './validate';
import { autoLayout } from './layout';

export { applyPreset } from './apply';
export { validateGraph } from './validate';
export { autoLayout } from './layout';
export { remapIds, boundsOf, offsetPositions } from './remap';
export { registerFlow, getFlow } from './flow-bridge';
export type { Preset, PresetGraph, PresetViewport } from './types';
export { PRESET_VERSION } from './types';

// Dev-only console handle for exercising the loader without a UI:
//   window.__presets.apply(preset, { mode: 'merge' })
if (import.meta.env.DEV && typeof window !== 'undefined') {
	(window as unknown as { __presets: unknown }).__presets = {
		apply: applyPreset,
		validateGraph,
		autoLayout
	};
}
