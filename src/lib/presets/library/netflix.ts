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
				node('load-1', 'load', { label: 'Tráfego', rps: 2400 }, { position: { x: 0, y: 240 } }),
				node(
					'api-gateway-1',
					'api-gateway',
					{ label: 'API Gateway' },
					{ position: { x: 220, y: 240 } }
				),
				node(
					'service-1',
					'service',
					{ label: 'Playback', language: 'java', capacity: 3000 },
					{ position: { x: 460, y: 40 } }
				),
				node(
					'service-2',
					'service',
					{ label: 'Usuário', language: 'java', capacity: 3000 },
					{ position: { x: 460, y: 440 } }
				),
				node(
					'service-3',
					'service',
					{
						label: 'Recomendações',
						language: 'python',
						capacity: 3000
					},
					{ position: { x: 460, y: 200 } }
				),
				node(
					'cache-1',
					'cache',
					{ label: 'Cache de perfil', hitRatio: 0.85 },
					{ position: { x: 740, y: 440 } }
				),
				node(
					'database-1',
					'database',
					{ label: 'Playback DB', engine: 'mysql', capacity: 2000 },
					{ position: { x: 740, y: 40 } }
				),
				node(
					'database-2',
					'database',
					{ label: 'Usuário DB', engine: 'postgres', capacity: 2000 },
					{ position: { x: 1020, y: 440 } }
				),
				node(
					'database-3',
					'database',
					{ label: 'Recs DB', engine: 'mongo', capacity: 2000 },
					{ position: { x: 740, y: 200 } }
				)
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
