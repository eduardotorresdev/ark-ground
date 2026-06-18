import Layers from '@lucide/svelte/icons/layers';
import PoolNode from '$lib/nodes/PoolNode.svelte';
import type { NodeDef } from '../types';

/**
 * A pool is created by duplicating a service — never dropped from the palette
 * (hence `hidden`). Its only inbound port accepts a load balancer, enforcing
 * "a pool needs a balancer". Capacity is the sum of its replicas.
 */
export const poolDef: NodeDef<'pool'> = {
	kind: 'pool',
	label: 'Pool de réplicas',
	category: 'Simulação',
	icon: Layers,
	accent: 'border-slate-300 bg-slate-50 text-slate-700',
	hidden: true,
	ports: [
		{ id: 'in', dir: 'in', accepts: ['load-balancer'] },
		{ id: 'out', dir: 'out' }
	],
	component: PoolNode,
	create: () => ({ label: 'Pool', capacity: 500, version: 1 })
};
