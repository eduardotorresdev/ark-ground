import Database from '@lucide/svelte/icons/database';
import type { NodeDef } from '../types';

export const databaseDef: NodeDef<'database'> = {
	kind: 'database',
	label: 'Banco de dados',
	category: 'Dados',
	icon: Database,
	accent: 'border-amber-300 bg-amber-50 text-amber-700',
	ports: [{ id: 'conn', dir: 'in', label: 'conexões' }],
	create: () => ({
		label: 'Database',
		engine: 'postgres',
		persistent: true,
		capacity: 1000,
		mode: 'single',
		replicaCount: 2,
		readRatio: 0.8,
		shardCount: 2,
		skew: 0
	})
};
