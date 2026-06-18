import Database from '@lucide/svelte/icons/database';
import DatabaseNode from '$lib/nodes/DatabaseNode.svelte';
import type { NodeDef } from '../types';

export const databaseDef: NodeDef<'database'> = {
	kind: 'database',
	label: 'Banco de dados',
	category: 'Dados',
	icon: Database,
	accent: 'border-amber-300 bg-amber-50 text-amber-700',
	ports: [{ id: 'conn', dir: 'in', label: 'conexões' }],
	component: DatabaseNode,
	create: () => ({ label: 'Database', engine: 'postgres', persistent: true, capacity: 1000 })
};
