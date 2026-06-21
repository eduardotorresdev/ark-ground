import { siShopify } from 'simple-icons';
import { PRESET_VERSION } from '../types';
import { edge, node, replica, snapshot } from './build';
import type { PresetEntry } from './types';

const MODULES = [
	{ id: 'checkout', label: 'Checkout' },
	{ id: 'catalog', label: 'Catálogo' },
	{ id: 'payments', label: 'Pagamentos' },
	{ id: 'admin', label: 'Admin' }
];

/**
 * Shopify — monólito modular (Core) com banco shardado por shop_id: balanceador,
 * réplicas da aplicação e banco particionado.
 */
export const shopify: PresetEntry = {
	category: 'monoliths',
	icon: siShopify,
	preset: {
		presetVersion: PRESET_VERSION,
		meta: {
			id: 'shopify',
			name: 'Shopify',
			description:
				'Monólito modular (Core) atrás de balanceador, com banco shardado por shop_id (particionamento).'
		},
		graph: snapshot(
			[
				node('load-1', 'load', { label: 'Tráfego', rps: 1500 }),
				node('load-balancer-1', 'load-balancer', { label: 'Balanceador' }),
				node('pool-1', 'pool', { label: 'Core', capacity: 1800 }),
				replica('monolith-1', 'monolith', 'pool-1', {
					label: 'Core',
					language: 'ruby',
					modules: MODULES
				}),
				replica('monolith-2', 'monolith', 'pool-1', {
					label: 'Core',
					language: 'ruby',
					modules: MODULES
				}),
				node('database-1', 'database', {
					label: 'MySQL (pods)',
					engine: 'mysql',
					mode: 'sharded',
					shardCount: 4,
					skew: 0.2,
					capacity: 1500
				})
			],
			[
				edge('load-1', 'load-balancer-1'),
				edge('load-balancer-1', 'pool-1'),
				edge('pool-1', 'database-1')
			]
		)
	}
};
