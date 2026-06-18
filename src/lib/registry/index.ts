import type { NodeDef, NodeKind } from './types';
import { serviceDef } from './nodes/service';
import { databaseDef } from './nodes/database';
import { gatewayDef } from './nodes/api-gateway';
import { loadDef } from './nodes/load';
import { loadBalancerDef } from './nodes/load-balancer';
import { poolDef } from './nodes/pool';
import { monolithDef } from './nodes/monolith';

/** Central registry: kind -> definition. Add new kinds here and in NodeKind. */
export const registry: Record<NodeKind, NodeDef> = {
	load: loadDef,
	'api-gateway': gatewayDef,
	'load-balancer': loadBalancerDef,
	service: serviceDef,
	monolith: monolithDef,
	pool: poolDef,
	database: databaseDef
};

/** Flat list for the palette, in registry order, excluding hidden kinds. */
export const palette: NodeDef[] = Object.values(registry).filter((d) => !d.hidden);

export function getDef(kind: NodeKind): NodeDef {
	return registry[kind];
}

/**
 * Connection rule: the source's `out` port must accept the target's kind AND
 * the target's `in` port must accept the source's kind. A node without the
 * matching port cannot take part. `accepts` omitted means "any kind".
 */
export function canConnect(srcKind: NodeKind, dstKind: NodeKind): boolean {
	const out = registry[srcKind].ports.find((p) => p.dir === 'out');
	if (!out || (out.accepts && !out.accepts.includes(dstKind))) return false;
	const inp = registry[dstKind].ports.find((p) => p.dir === 'in');
	if (!inp || (inp.accepts && !inp.accepts.includes(srcKind))) return false;
	return true;
}
