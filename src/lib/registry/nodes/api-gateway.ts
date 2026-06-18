import Globe from '@lucide/svelte/icons/globe';
import GatewayNode from '$lib/nodes/GatewayNode.svelte';
import type { NodeDef } from '../types';

export const gatewayDef: NodeDef<'api-gateway'> = {
	kind: 'api-gateway',
	label: 'API Gateway',
	category: 'Borda',
	icon: Globe,
	accent: 'border-indigo-300 bg-indigo-50 text-indigo-700',
	ports: [
		{ id: 'in', dir: 'in' },
		{ id: 'out', dir: 'out', accepts: ['service', 'load-balancer', 'monolith'] }
	],
	component: GatewayNode,
	create: () => ({ label: 'API Gateway', capacity: 5000 })
};
