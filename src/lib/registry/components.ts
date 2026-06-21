import type { Component } from 'svelte';
import type { NodeProps } from '@xyflow/svelte';
import type { NodeKind } from './types';
import ServiceNode from '$lib/nodes/ServiceNode.svelte';
import DatabaseNode from '$lib/nodes/DatabaseNode.svelte';
import GatewayNode from '$lib/nodes/GatewayNode.svelte';
import LoadNode from '$lib/nodes/LoadNode.svelte';
import LoadBalancerNode from '$lib/nodes/LoadBalancerNode.svelte';
import PoolNode from '$lib/nodes/PoolNode.svelte';
import MonolithNode from '$lib/nodes/MonolithNode.svelte';
import BrokerNode from '$lib/nodes/BrokerNode.svelte';
import CacheNode from '$lib/nodes/CacheNode.svelte';

/**
 * Kind → canvas component. Kept separate from the registry data on purpose: this
 * is the *only* module that imports the node `.svelte` components (and through
 * them `@xyflow/svelte`). Logic-only consumers of the registry (validation,
 * presets, the sim engine) import metadata without dragging the UI — and the
 * Svelte/xyflow source — into Node-environment tooling.
 */
export const nodeComponents: Record<NodeKind, Component<NodeProps>> = {
	service: ServiceNode,
	database: DatabaseNode,
	'api-gateway': GatewayNode,
	load: LoadNode,
	'load-balancer': LoadBalancerNode,
	pool: PoolNode,
	monolith: MonolithNode,
	broker: BrokerNode,
	cache: CacheNode
};
