import { siNetflix } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, snapshot } from './build';
import type { PresetEntry } from './types';

/**
 * Netflix — API Gateway distribuindo para serviços (Playback, Usuário,
 * Recomendações), cada um com seu banco, com cache e chamada serviço→serviço.
 * (Sem CDN/edge — fora do escopo do modelo atual.)
 */
export const netflix: PresetEntry = {
	category: 'microservices',
	icon: siNetflix,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'netflix',
			name: 'Netflix',
			description:
				'Gateway para serviços (Playback, Usuário, Recomendações), banco por serviço, cache e chamada serviço→serviço.'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 6000 }),
				node('api-gateway-1', 'api-gateway', { label: 'API Gateway' }),
				node('service-1', 'service', { label: 'Playback', language: 'java', capacity: 1500 }),
				node('service-2', 'service', { label: 'Usuário', language: 'java', capacity: 1500 }),
				node('service-3', 'service', {
					label: 'Recomendações',
					language: 'python',
					capacity: 1500
				}),
				node('cache-1', 'cache', { label: 'Cache de perfil', hitRatio: 0.85 }),
				node('database-1', 'database', { label: 'Playback DB', engine: 'mysql' }),
				node('database-2', 'database', { label: 'Usuário DB', engine: 'postgres' }),
				node('database-3', 'database', { label: 'Recs DB', engine: 'mongo' })
			],
			[
				edge('load-1', 'api-gateway-1'),
				edge('api-gateway-1', 'service-1'),
				edge('api-gateway-1', 'service-2'),
				edge('api-gateway-1', 'service-3'),
				edge('service-1', 'database-1'),
				edge('service-2', 'cache-1'),
				edge('cache-1', 'database-2'),
				edge('service-3', 'database-3'),
				// chamada serviço→serviço: Playback consulta Recomendações
				edge('service-1', 'service-3')
			]
		)
	}
};
