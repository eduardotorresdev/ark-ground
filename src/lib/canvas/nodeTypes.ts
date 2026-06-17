import type { NodeTypes } from '@xyflow/svelte';
import { registry } from '$lib/registry';
import type { NodeKind } from '$lib/registry/types';

/** Build the Svelte Flow nodeTypes map from the registry. */
export const nodeTypes: NodeTypes = Object.fromEntries(
	(Object.keys(registry) as NodeKind[]).map((kind) => [kind, registry[kind].component])
);
