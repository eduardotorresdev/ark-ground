import type { Component } from 'svelte';
import type { Node, NodeProps } from '@xyflow/svelte';

/** Every architecture component kind. Add new kinds here. */
export type NodeKind = 'service' | 'database' | 'api-gateway' | 'load' | 'load-balancer' | 'pool';

export type PortDir = 'in' | 'out';

export type PortSpec = {
	id: string;
	dir: PortDir;
	label?: string;
	/** which kinds this port may connect to; omit = any kind */
	accepts?: NodeKind[];
};

/** Load-balancer distribution strategies. Each maps to a steady-state split function. */
export type LbAlgorithm = 'round-robin' | 'weighted' | 'least-connections';

/**
 * Per-kind data shapes. These MUST be `type` aliases (not interfaces) so they
 * satisfy `Record<string, unknown>`, which @xyflow/svelte requires for node data.
 *
 * `capacity` is always in requests/second (req/s) — the load a node can serve
 * before it saturates and starts dropping the excess.
 */
export type ServiceData = {
	kind: 'service';
	label: string;
	/** requests/second this instance can serve */
	capacity: number;
	language?: string;
};

export type DatabaseData = {
	kind: 'database';
	label: string;
	engine: 'postgres' | 'mysql' | 'mongo' | 'redis';
	persistent: boolean;
	capacity: number;
};

export type GatewayData = {
	kind: 'api-gateway';
	label: string;
	capacity: number;
};

/** Traffic generator. Injects a constant req/s into whatever it is wired to. */
export type LoadData = {
	kind: 'load';
	label: string;
	/** requests/second emitted */
	rps: number;
};

/** Distributes incoming load across the replicas of the pool it feeds. */
export type LoadBalancerData = {
	kind: 'load-balancer';
	label: string;
	algorithm: LbAlgorithm;
	/** req/s the balancer itself can pass through (usually very high) */
	capacity: number;
};

/**
 * Wrapper grouping replicas of a service. `capacity` is the per-replica capacity
 * that every child inherits; total pool capacity = capacity × replica count.
 */
export type PoolData = {
	kind: 'pool';
	label: string;
	capacity: number;
};

/** Discriminated union over `kind`. */
export type ArchData =
	| ServiceData
	| DatabaseData
	| GatewayData
	| LoadData
	| LoadBalancerData
	| PoolData;

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
	/** hide from the palette (e.g. pools, which are created by duplicating) */
	hidden?: boolean;
};
