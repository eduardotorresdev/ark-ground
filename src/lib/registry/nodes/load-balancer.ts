import Split from '@lucide/svelte/icons/split';
import type { NodeDef } from '../types';

export const loadBalancerDef: NodeDef<'load-balancer'> = {
	kind: 'load-balancer',
	label: 'Load Balancer',
	category: 'Simulação',
	icon: Split,
	accent: 'border-sky-300 bg-sky-50 text-sky-700',
	ports: [
		{ id: 'in', dir: 'in', accepts: ['load', 'api-gateway', 'service', 'broker', 'cache'] },
		{ id: 'out', dir: 'out', accepts: ['pool', 'service', 'monolith'] }
	],
	create: () => ({ label: 'Load Balancer', algorithm: 'round-robin', capacity: 100000 })
};
