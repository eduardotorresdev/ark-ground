import type { NodeDef, NodeKind } from './types';
import { serviceDef } from './nodes/service';
import { databaseDef } from './nodes/database';
import { gatewayDef } from './nodes/api-gateway';

/** Central registry: kind -> definition. Add new kinds here and in NodeKind. */
export const registry: Record<NodeKind, NodeDef> = {
	service: serviceDef,
	database: databaseDef,
	'api-gateway': gatewayDef
};

/** Flat list for the palette, in registry order. */
export const palette: NodeDef[] = Object.values(registry);

export function getDef(kind: NodeKind): NodeDef {
	return registry[kind];
}

/**
 * Connection rule: the source's `out` port must accept the target's kind.
 * A node without an `out` port cannot originate a connection.
 */
export function canConnect(srcKind: NodeKind, dstKind: NodeKind): boolean {
	const out = registry[srcKind].ports.find((p) => p.dir === 'out');
	if (!out) return false;
	return !out.accepts || out.accepts.includes(dstKind);
}
