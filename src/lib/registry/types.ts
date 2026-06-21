import type { Component } from 'svelte';
import type { Node } from '@xyflow/svelte';

/** Every architecture component kind. Add new kinds here. */
export type NodeKind =
	| 'service'
	| 'database'
	| 'api-gateway'
	| 'load'
	| 'load-balancer'
	| 'pool'
	| 'monolith'
	| 'broker'
	| 'cache';

/** Deploy strategies, in order of increasing safety. */
export type DeployStrategy = 'recreate' | 'blue-green' | 'rolling';

/** A logical module living inside a monolith (illustrative; not a sim node). */
export type Module = { id: string; label: string };

export type PortDir = 'in' | 'out';

/**
 * Optional per-edge data. `amplification` is the call fan-out of a synchronous
 * edge: 1 caller request → N downstream calls (integer ≥ 1, default 1). Edges are
 * typed loosely by @xyflow/svelte, so this is documentation + a typed accessor
 * shape, not an enforced schema.
 */
export type LoadEdgeData = { amplification?: number };

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
	/** deployed version; bumps on each deploy */
	version: number;
};

/**
 * How a database scales horizontally.
 * - `single`: one instance; `capacity` is the whole thing (legacy default).
 * - `replicas`: primary + read replicas. Reads spread across the pool (primary
 *   included), writes hit only the primary. Needs a read/write split (`readRatio`).
 * - `sharded`: load partitioned by key across `shardCount` shards; capacity scales
 *   for both reads and writes. `skew` concentrates load onto one hot shard.
 */
export type DbMode = 'single' | 'replicas' | 'sharded';

export type DatabaseData = {
	kind: 'database';
	label: string;
	engine: 'postgres' | 'mysql' | 'mongo' | 'redis';
	persistent: boolean;
	/** req/s PER INSTANCE (per replica / per shard / the single instance) */
	capacity: number;
	/** scaling mode; absent ⇒ 'single' (backward compatible) */
	mode?: DbMode;
	/** replicas mode: number of read replicas (excludes the primary), ≥ 1 */
	replicaCount?: number;
	/** replicas mode: fraction of load that is reads, 0..1 */
	readRatio?: number;
	/** sharded mode: number of shards, ≥ 1 */
	shardCount?: number;
	/** sharded mode: hot-shard skew intensity, 0 (uniform) .. 1 (all on one shard) */
	skew?: number;
};

export type GatewayData = {
	kind: 'api-gateway';
	label: string;
	capacity: number;
	/**
	 * Relative routing weight per downstream target node id. The gateway splits
	 * its served load across targets proportionally to these weights (a target
	 * with no entry uses the default weight). Lets you model "posts get more
	 * traffic than users" instead of broadcasting the full load to each.
	 */
	weights?: Record<string, number>;
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
	/** deployed version; bumps on each deploy */
	version: number;
};

/**
 * A monolith: a single deployable/throttled unit that *contains* modules. The
 * modules are illustrative — internally it simulates as one service (one
 * capacity, one version). Converting to microservices turns each module into a
 * standalone service behind a gateway.
 */
export type MonolithData = {
	kind: 'monolith';
	label: string;
	/** requests/second the whole monolith can serve */
	capacity: number;
	/** deployed version; one version covers every module */
	version: number;
	modules: Module[];
	language?: string;
};

/** topic = fan-out (every consumer gets every quantum); work-queue = competing consumers. */
export type BrokerMode = 'topic' | 'work-queue';
/** What the broker does when its buffer is full. */
export type BrokerFullPolicy = 'backpressure' | 'drop';

/**
 * Asynchronous message broker / queue. Unlike every other node, it is *stateful*:
 * it accepts published load into a buffer regardless of how fast the consumers
 * drain it, so a slow consumer builds backlog over time instead of immediately
 * back-pressuring the producer. The backlog is integrated frame-by-frame in the
 * sim store; `computeSim` reads the current backlog to decide the drain rate.
 *
 * - `topic`: fan-out. Each consumer has its own offset over a shared log, so a
 *   fast consumer stays caught up while a slow one lags alone.
 * - `work-queue`: competing consumers share one queue; drain = sum of capacities.
 *
 * No `capacity` (its egress ceiling is `maxDeliveryRate`) and no `version`
 * (it is infrastructure, like the load balancer — not deployed).
 */
export type BrokerData = {
	kind: 'broker';
	label: string;
	mode: BrokerMode;
	/** max quanta the buffer can hold — a count, not a rate */
	bufferSize: number;
	/** ceiling on the delivery throughput (req/s); the broker's own infra limit */
	maxDeliveryRate: number;
	fullPolicy: BrokerFullPolicy;
};

/**
 * Read-through cache fronting a downstream backing node. Of the load it serves,
 * the *hit* fraction is answered immediately (never forwarded), and only the
 * *miss* fraction is emitted to the backing — so the node behind it sees its
 * offered load reduced proportionally to the effective hit ratio.
 *
 * Like every synchronous node it has its own `capacity` (req/s) and can saturate
 * on its own under high load. The effective hit ratio is `hitRatio` modulated by
 * a temporal "warmth" in [0, 1]: with `ttlSeconds > 0` the cache starts cold and
 * warms up as traffic populates it (time constant ~TTL), and entries expire when
 * traffic subsides — so it can visibly go cold → warming → healthy. With
 * `ttlSeconds = 0` warmth is pinned to 1 (a constant hit ratio). The warmth is
 * integrated frame-by-frame in the sim store, like the broker backlog.
 */
export type CacheData = {
	kind: 'cache';
	label: string;
	/** requests/second this cache can serve (hits + misses) before saturating */
	capacity: number;
	/** target hit ratio in [0, 1] (the warm, steady-state fraction of hits) */
	hitRatio: number;
	/** entry time-to-live in seconds; drives the warmth ramp. 0 = always warm */
	ttlSeconds: number;
};

/** Discriminated union over `kind`. */
export type ArchData =
	| ServiceData
	| DatabaseData
	| GatewayData
	| LoadData
	| LoadBalancerData
	| PoolData
	| MonolithData
	| BrokerData
	| CacheData;

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
	/** default data (minus the discriminant) applied when dropped */
	create: () => Omit<DataOf<K>, 'kind'>;
	/** hide from the palette (e.g. pools, which are created by duplicating) */
	hidden?: boolean;
};
