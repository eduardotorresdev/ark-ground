import Split from '@lucide/svelte/icons/split';
import LoadBalancerNode from '$lib/nodes/LoadBalancerNode.svelte';
import type { NodeDef } from '../types';

export const loadBalancerDef: NodeDef<'load-balancer'> = {
	kind: 'load-balancer',
	label: 'Load Balancer',
	category: 'Simulação',
	icon: Split,
	accent: 'border-sky-300 bg-sky-50 text-sky-700',
	ports: [
		{ id: 'in', dir: 'in', accepts: ['load', 'api-gateway', 'service', 'broker'] },
		{ id: 'out', dir: 'out', accepts: ['pool', 'service', 'monolith'] }
	],
	component: LoadBalancerNode,
	create: () => ({ label: 'Load Balancer', algorithm: 'round-robin', capacity: 100000 })
};
