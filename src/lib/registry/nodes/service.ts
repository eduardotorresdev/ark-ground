import Server from '@lucide/svelte/icons/server';
import type { NodeDef } from '../types';

export const serviceDef: NodeDef<'service'> = {
	kind: 'service',
	label: 'Serviço',
	category: 'Aplicação',
	icon: Server,
	accent: 'border-emerald-300 bg-emerald-50 text-emerald-700',
	ports: [
		{ id: 'in', dir: 'in' },
		{ id: 'out', dir: 'out' }
	],
	create: () => ({ label: 'Serviço', capacity: 500, version: 1 })
};
