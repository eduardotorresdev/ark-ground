import type { Viewport } from '@xyflow/svelte';

/**
 * Minimal handle to the @xyflow/svelte instance. `useSvelteFlow()` is only
 * callable inside a component under <SvelteFlowProvider>, so the Editor registers
 * the handles here and the (non-component) preset loader consumes them.
 */
export type FlowHandles = {
	setViewport: (viewport: Viewport, options?: { duration?: number }) => void | Promise<boolean>;
	fitView: (options?: { duration?: number }) => void | Promise<boolean>;
};

let handles: FlowHandles | null = null;

export function registerFlow(h: FlowHandles): void {
	handles = h;
}

export function getFlow(): FlowHandles | null {
	return handles;
}
