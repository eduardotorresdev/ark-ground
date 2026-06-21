import Boxes from '@lucide/svelte/icons/boxes';
import type { NodeDef } from '../types';

/**
 * A monolith: one deployable unit holding several modules. It simulates as a
 * single service (one capacity, one version). Starts with no modules — the user
 * adds them in the inspector. Converting to microservices turns each module
 * into a standalone service behind an API gateway.
 */
export const monolithDef: NodeDef<'monolith'> = {
	kind: 'monolith',
	label: 'Monolito',
	category: 'Aplicação',
	icon: Boxes,
	accent: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700',
	ports: [
		{ id: 'in', dir: 'in' },
		{ id: 'out', dir: 'out', accepts: ['database', 'service', 'broker', 'cache'] }
	],
	create: () => ({ label: 'Monolito', capacity: 900, version: 1, modules: [] })
};
