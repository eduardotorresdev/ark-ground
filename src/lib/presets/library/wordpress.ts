import { siWordpress } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, replica, snapshot } from './build';
import type { PresetEntry } from './types';

/**
 * WordPress — pilha LAMP clássica: load → balanceador → pool da aplicação (PHP) →
 * cache → banco MySQL com réplicas de leitura.
 */
export const wordpress: PresetEntry = {
	category: 'monoliths',
	icon: siWordpress,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'wordpress',
			name: 'WordPress',
			description:
				'Pilha LAMP: balanceador, réplicas da aplicação, cache e MySQL com réplicas de leitura.'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 2000 }),
				node('load-balancer-1', 'load-balancer', { label: 'Balanceador' }),
				node('pool-1', 'pool', { label: 'WordPress (PHP)', capacity: 800 }),
				replica('monolith-1', 'monolith', 'pool-1', { label: 'WordPress', language: 'php' }),
				replica('monolith-2', 'monolith', 'pool-1', { label: 'WordPress', language: 'php' }),
				node('cache-1', 'cache', { label: 'Object cache', hitRatio: 0.8 }),
				node('database-1', 'database', {
					label: 'MySQL',
					engine: 'mysql',
					mode: 'replicas',
					replicaCount: 2,
					readRatio: 0.9,
					capacity: 1200
				})
			],
			[
				edge('load-1', 'load-balancer-1'),
				edge('load-balancer-1', 'pool-1'),
				edge('pool-1', 'cache-1'),
				edge('cache-1', 'database-1')
			]
		)
	}
};
