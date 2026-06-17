import type { Component } from 'svelte';
import type { Node, NodeProps } from '@xyflow/svelte';

/** Every architecture component kind. Add new kinds here. */
export type NodeKind = 'service' | 'database' | 'api-gateway';

export type PortDir = 'in' | 'out';

export type PortSpec = {
	id: string;
	dir: PortDir;
	label?: string;
	/** which kinds this port may connect to; omit = any kind */
	accepts?: NodeKind[];
};

/**
 * Per-kind data shapes. These MUST be `type` aliases (not interfaces) so they
 * satisfy `Record<string, unknown>`, which @xyflow/svelte requires for node data.
 */
export type ServiceData = {
	kind: 'service';
	label: string;
	replicas: number;
	language?: string;
};

export type DatabaseData = {
	kind: 'database';
	label: string;
	engine: 'postgres' | 'mysql' | 'mongo' | 'redis';
	persistent: boolean;
};

export type GatewayData = {
	kind: 'api-gateway';
	label: string;
	routes: number;
};

/** Discriminated union over `kind`. */
export type ArchData = ServiceData | DatabaseData | GatewayData;

/** A node on the canvas, typed with our domain data. */
export type ArchNode = Node<ArchData>;

/** Map a kind to its concrete data shape. */
export type DataOf<K extends NodeKind> = Extract<ArchData, { kind: K }>;

/** Registry entry describing one architecture component kind. */
export type NodeDef<K extends NodeKind = NodeKind> = {
	kind: K;
	/** label shown in the palette */
	label: string;
	/** palette grouping */
	category: string;
	/** lucide icon component */
	icon: Component;
	/** tailwind classes for the node accent (border/bg/text) */
	accent: string;
	/** connection ports */
	ports: PortSpec[];
	/** svelte component rendered on the canvas */
	component: Component<NodeProps>;
	/** default data (minus the discriminant) applied when dropped */
	create: () => Omit<DataOf<K>, 'kind'>;
};
