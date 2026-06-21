/**
 * Test-only stub for `@xyflow/svelte`, aliased in for the node ("server") test
 * project (see vite.config.ts).
 *
 * Pure-logic tests (sim engine, presets, migrations) import `$lib/registry`,
 * which statically pulls in the `.svelte` node components, which in turn import
 * `@xyflow/svelte`. The library ships TypeScript `.svelte` source, and the Svelte
 * compiler's type-stripping mishandles one of its files under rolldown, breaking
 * the whole node suite. None of these tests render components, so we swap the
 * library for harmless stubs that only need to satisfy the value imports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const noop: any = () => {};

export const Handle: any = noop;
export const BaseEdge: any = noop;
export const ViewportPortal: any = noop;
export const SvelteFlow: any = noop;
export const SvelteFlowProvider: any = noop;
export const Background: any = noop;
export const Controls: any = noop;
export const MiniMap: any = noop;
export const Panel: any = noop;

export const Position = {
	Left: 'left',
	Right: 'right',
	Top: 'top',
	Bottom: 'bottom'
} as const;

export const getBezierPath: any = () => ['', 0, 0, 0, 0];
export const getNodesBounds: any = () => ({ x: 0, y: 0, width: 0, height: 0 });
export const useStore: any = () => ({});
export const useSvelteFlow: any = () => ({});
export const addEdge: any = (_conn: any, edges: any) => edges;
