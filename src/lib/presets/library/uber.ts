import { siUber } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, snapshot } from './build';
import type { PresetEntry } from './types';

/**
 * Uber — serviços por domínio (Viagem, Motorista, Pagamentos) atrás do gateway,
 * banco por serviço e eventos assíncronos via fila. (Sem container de domínio —
 * fora do escopo do modelo atual; os nomes indicam o domínio.)
 */
export const uber: PresetEntry = {
	category: 'microservices',
	icon: siUber,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'uber',
			name: 'Uber',
			description:
				'Serviços por domínio (Viagem, Motorista, Pagamentos) atrás do gateway, banco por serviço e eventos via fila.'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 3000 }),
				node('api-gateway-1', 'api-gateway', { label: 'API Gateway' }),
				node('service-1', 'service', { label: 'Viagem', language: 'go', capacity: 3000 }),
				node('service-2', 'service', { label: 'Motorista', language: 'go', capacity: 3000 }),
				node('service-3', 'service', { label: 'Pagamentos', language: 'java', capacity: 3000 }),
				node('broker-1', 'broker', { label: 'Eventos de viagem', mode: 'work-queue' }),
				node('database-1', 'database', { label: 'Viagem DB', engine: 'postgres', capacity: 2000 }),
				node('database-2', 'database', {
					label: 'Motorista DB',
					engine: 'postgres',
					capacity: 2000
				}),
				node('database-3', 'database', {
					label: 'Pagamentos DB',
					engine: 'postgres',
					capacity: 2000
				})
			],
			[
				edge('load-1', 'api-gateway-1'),
				edge('api-gateway-1', 'service-1'),
				edge('api-gateway-1', 'service-2'),
				edge('api-gateway-1', 'service-3'),
				edge('service-1', 'database-1'),
				edge('service-2', 'database-2'),
				edge('service-3', 'database-3'),
				// evento assíncrono: Viagem publica, Motorista consome
				edge('service-1', 'broker-1'),
				edge('broker-1', 'service-2')
			]
		)
	}
};
