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
			'O modo "single" usa uma única instância: toda a carga — leituras e escritas — vai para um só banco. É o mais simples, mas não escala horizontalmente: a capacidade é fixa.'
	},
	{
		id: 'replicas',
		label: 'replicas',
		icon: GitFork,
		description:
			'O modo "replicas" mantém um primário para escritas e réplicas para leituras. A capacidade de leitura escala com o número de réplicas (primário incluído); as escritas continuam limitadas ao primário. O lag de replicação cresce quando o primário enche.'
	},
	{
		id: 'sharded',
		label: 'sharding',
		icon: LayoutGrid,
		description:
			'O modo "sharding" particiona os dados por chave entre vários shards. Leitura e escrita escalam com o número de shards, mas um shard quente (skew) pode saturar sozinho enquanto os outros ficam ociosos, derrubando a capacidade efetiva.'
	}
];

export function dbModeOption(id: DbMode | undefined): DbModeOption {
	return DB_MODES.find((m) => m.id === (id ?? 'single')) ?? DB_MODES[0];
}
