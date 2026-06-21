import Zap from '@lucide/svelte/icons/zap';
import LoadNode from '$lib/nodes/LoadNode.svelte';
import type { NodeDef } from '../types';

export const loadDef: NodeDef<'load'> = {
	kind: 'load',
	label: 'Carga',
	category: 'Simulação',
	icon: Zap,
	accent: 'border-violet-300 bg-violet-50 text-violet-700',
	ports: [
		{
			id: 'out',
			dir: 'out',
			accepts: ['api-gateway', 'service', 'load-balancer', 'monolith', 'broker']
		}
	],
	component: LoadNode,
	create: () => ({ label: 'Carga', rps: 100 })
};
