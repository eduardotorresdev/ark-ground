import type { EdgeTypes } from '@xyflow/svelte';
import LoadEdge from './LoadEdge.svelte';

/** All edges render as load-aware edges (colored + flowing by traffic). */
export const edgeTypes: EdgeTypes = { load: LoadEdge };
