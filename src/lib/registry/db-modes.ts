import type { Component } from 'svelte';
import Database from '@lucide/svelte/icons/database';
import GitFork from '@lucide/svelte/icons/git-fork';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import type { DbMode } from './types';

/** Mode picker metadata for the database node: label, icon and the help text shown below the buttons. */
export type DbModeOption = {
	id: DbMode;
	label: string;
	icon: Component;
	description: string;
};

export const DB_MODES: DbModeOption[] = [
	{
		id: 'single',
		label: 'single',
		icon: Database,
		description:
			'Um único banco cuida de tudo — leituras e gravações. É o jeito mais simples de começar, mas tem um limite fixo: passou do que ele aguenta, começa a falhar.'
	},
	{
		id: 'replicas',
		label: 'replicas',
		icon: GitFork,
		description:
			'Um banco principal recebe as gravações e cópias dele respondem às leituras. Como a maioria dos sistemas lê muito mais do que grava, adicionar cópias aguenta muito mais acesso. As gravações continuam só no principal, então elas não ficam mais rápidas.'
	},
	{
		id: 'sharded',
		label: 'sharding',
		icon: LayoutGrid,
		description:
			'Os dados são divididos em pedaços, cada um num banco diferente (por exemplo, separando usuários por região). Assim leituras e gravações crescem juntas conforme você adiciona pedaços. O cuidado: se um pedaço receber acesso demais, ele sozinho vira o gargalo enquanto os outros ficam parados.'
	}
];

export function dbModeOption(id: DbMode | undefined): DbModeOption {
	return DB_MODES.find((m) => m.id === (id ?? 'single')) ?? DB_MODES[0];
}
