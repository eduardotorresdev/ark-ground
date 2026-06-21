import { siInstagram } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, replica, snapshot } from './build';
import type { PresetEntry } from './types';

/**
 * Instagram — monólito Django atrás de balanceador, com cache, Postgres (réplicas
 * de leitura) e um segundo store (Cassandra) para o feed.
 */
export const instagram: PresetEntry = {
	category: 'monoliths',
	icon: siInstagram,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'instagram',
			name: 'Instagram',
			description:
				'Monólito Django com cache, Postgres com réplicas de leitura e um segundo store (Cassandra) para o feed.'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 4000 }),
				node('load-balancer-1', 'load-balancer', { label: 'Balanceador' }),
				node('pool-1', 'pool', { label: 'Django', capacity: 1200 }),
				replica('monolith-1', 'monolith', 'pool-1', { label: 'Django', language: 'python' }),
				replica('monolith-2', 'monolith', 'pool-1', { label: 'Django', language: 'python' }),
				node('cache-1', 'cache', { label: 'Cache', hitRatio: 0.85 }),
				node('database-1', 'database', {
					label: 'Postgres',
					engine: 'postgres',
					mode: 'replicas',
					replicaCount: 3,
					readRatio: 0.9,
					capacity: 1500
				}),
				// Cassandra não existe na lista de engines do nó; modelado como store
				// adicional usando o engine mongo como stand-in (a marca do card é o Instagram).
				node('database-2', 'database', {
					label: 'Cassandra (feed)',
					engine: 'mongo',
					mode: 'sharded',
					shardCount: 4,
					capacity: 1500
				})
			],
			[
				edge('load-1', 'load-balancer-1'),
				edge('load-balancer-1', 'pool-1'),
				edge('pool-1', 'cache-1'),
				edge('cache-1', 'database-1'),
				edge('pool-1', 'database-2')
			]
		)
	}
};
