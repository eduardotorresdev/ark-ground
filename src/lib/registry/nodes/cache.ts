import DatabaseZap from '@lucide/svelte/icons/database-zap';
import type { NodeDef } from '../types';

/**
 * Read-through cache fronting a backing node. It serves the hit fraction of its
 * load locally and forwards only the misses downstream, so the backing's offered
 * load drops in proportion to the effective hit ratio. It has its own capacity
 * (can saturate on its own) and a TTL that drives both a temporal warmth (cold →
 * warming → healthy) and a steady-state expiry erosion: a longer TTL keeps data
 * cached longer, so more requests are answered as hits.
 */
export const cacheDef: NodeDef<'cache'> = {
	kind: 'cache',
	label: 'Cache',
	category: 'Dados',
	icon: DatabaseZap,
	accent: 'border-cyan-300 bg-cyan-50 text-cyan-700',
	ports: [
		{ id: 'in', dir: 'in' },
		{ id: 'out', dir: 'out', accepts: ['service', 'database', 'monolith', 'load-balancer'] }
	],
	create: () => ({ label: 'Cache', capacity: 5000, hitRatio: 0.8, ttlSeconds: 30 })
};
