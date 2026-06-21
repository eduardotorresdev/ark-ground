import type { NodeTypes } from '@xyflow/svelte';
import { nodeComponents } from '$lib/registry/components';

/** Svelte Flow nodeTypes map: kind → canvas component. */
export const nodeTypes = nodeComponents as unknown as NodeTypes;
