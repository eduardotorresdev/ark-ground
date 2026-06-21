import { siIfood } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, snapshot } from './build';
import type { PresetEntry } from './types';

/**
 * iFood — Pedido, Restaurante e Entrega atrás do gateway, cada um com seu banco
 * e uma fila desacoplando o fluxo de pedidos.
 */
export const ifood: PresetEntry = {
	category: 'microservices',
	icon: siIfood,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'ifood',
			name: 'iFood',
			description:
				'Pedido, Restaurante e Entrega atrás do gateway, banco por serviço e uma fila desacoplando os pedidos.'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 3000 }),
				node('api-gateway-1', 'api-gateway', { label: 'API Gateway' }),
				node('service-1', 'service', { label: 'Pedido', language: 'java', capacity: 3000 }),
				node('service-2', 'service', { label: 'Restaurante', language: 'java', capacity: 3000 }),
				node('service-3', 'service', { label: 'Entrega', language: 'go', capacity: 3000 }),
				node('broker-1', 'broker', { label: 'Fila de pedidos', mode: 'work-queue' }),
				node('database-1', 'database', { label: 'Pedido DB', engine: 'postgres', capacity: 2000 }),
				node('database-2', 'database', {
					label: 'Restaurante DB',
					engine: 'postgres',
					capacity: 2000
				}),
				node('database-3', 'database', { label: 'Entrega DB', engine: 'mongo', capacity: 2000 })
			],
			[
				edge('load-1', 'api-gateway-1'),
				edge('api-gateway-1', 'service-1'),
				edge('api-gateway-1', 'service-2'),
				edge('api-gateway-1', 'service-3'),
				edge('service-1', 'database-1'),
				edge('service-2', 'database-2'),
				edge('service-3', 'database-3'),
				// fila desacopla o pedido da entrega
				edge('service-1', 'broker-1'),
				edge('broker-1', 'service-3')
			]
		)
	}
};
