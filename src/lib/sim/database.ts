import type { DatabaseData, DbMode } from '$lib/registry/types';
import { bucket, type Level } from './engine';

/**
 * Horizontal database scaling — replica pools and sharding, as a *property* of the
 * database node (no new node kind).
 *
 * The key idea that keeps the engine untouched: a database's `capacity` is now
 * PER INSTANCE (per replica / per shard / the single box). The bottleneck of the
 * whole node — its *effective* capacity `Ceff` — is a constant that depends only on
 * the configuration, never on the load:
 *
 *   single   : Ceff = cap
 *   replicas : Ceff = cap / max(readRatio/(R+1), 1 − readRatio)
 *   sharded  : Ceff = cap / hotShare,  hotShare = 1/S + skew·(1 − 1/S)
 *
 * Because `offered / Ceff` is exactly the utilization of the busiest stream/shard,
 * `engine.capacityOf` just returns `Ceff` and the existing throttle, cascade gate
 * and temporal queue all keep working. `dbDetail` adds the per-unit breakdown
 * (read/write split, per-shard utilization, replication lag) purely for display —
 * analogous to the broker's `BrokerStat`.
 */

/** Seconds of replication lag added per unit of write over-utilization above 0.8. */
export const REP_LAG_SCALE = 5;

/** Utilization of one unit/stream, mirroring the engine's own convention. */
function util(load: number, cap: number): number {
	return cap > 0 ? load / cap : load > 0 ? Infinity : 0;
}

function clamp01(v: number): number {
	if (!(v > 0)) return 0;
	return v < 1 ? v : 1;
}

/** Read replicas (excluding the primary), ≥ 1. */
function replicas(d: DatabaseData): number {
	return Math.max(1, Math.round(d.replicaCount ?? 2));
}

/** Shard count, ≥ 1. */
function shards(d: DatabaseData): number {
	return Math.max(1, Math.round(d.shardCount ?? 2));
}

/** Fraction of total load landing on the hottest shard (uniform = 1/S). */
function hotShare(d: DatabaseData): number {
	const S = shards(d);
	return 1 / S + clamp01(d.skew ?? 0) * (1 - 1 / S);
}

/**
 * Effective (bottleneck) capacity of the database in req/s, given the per-instance
 * `baseCap` (already scaled by any deploy capMult). See the module doc for the math.
 */
export function effectiveDbCapacity(d: DatabaseData, baseCap: number): number {
	const mode: DbMode = d.mode ?? 'single';
	if (mode === 'replicas') {
		const R = replicas(d);
		const r = clamp01(d.readRatio ?? 0.8);
		const denom = Math.max(r / (R + 1), 1 - r);
		return denom > 0 ? baseCap / denom : baseCap;
	}
	if (mode === 'sharded') {
		const hs = hotShare(d);
		return hs > 0 ? baseCap / hs : baseCap;
	}
	return baseCap;
}

/** Per-replica / per-shard utilization bar. */
export type DbUnitStat = {
	label: string;
	util: number;
	level: Level;
	/** the saturating hot shard, when skew > 0 */
	hot?: boolean;
};

/** Display-only breakdown of a database's load. Attached to `NodeStat.db`. */
export type DbStat = {
	mode: DbMode;
	/** per-unit bars (read/write streams for replicas; one per shard for sharded) */
	units: DbUnitStat[];
	/** replicas mode: aggregate read stream */
	reads?: { util: number; capacity: number };
	/** replicas mode: aggregate write stream (primary only) */
	writes?: { util: number; capacity: number };
	/** replicas mode: read staleness as the primary's write path fills (seconds) */
	replicationLagSeconds?: number;
};

/**
 * Compute the per-unit detail for a database node. `baseCap` is the per-instance
 * capacity (req/s) already scaled by any deploy capMult; `offered` is the total
 * incoming load. Aggregate served/util/level are handled by the engine's generic
 * branch via `effectiveDbCapacity`; this is additive display data only.
 */
export function dbDetail(d: DatabaseData, offered: number, baseCap: number): DbStat {
	const mode: DbMode = d.mode ?? 'single';

	if (mode === 'replicas') {
		const R = replicas(d);
		const r = clamp01(d.readRatio ?? 0.8);
		const readPool = R + 1; // primary joins the read pool
		const readCap = baseCap * readPool;
		const writeCap = baseCap; // primary only
		const reads = offered * r;
		const writes = offered * (1 - r);
		const readUtil = util(reads, readCap);
		const writeUtil = util(writes, writeCap);
		const perReadUtil = util(reads / readPool, baseCap); // == readUtil

		const units: DbUnitStat[] = [
			{ label: 'primário · escrita', util: writeUtil, level: bucket(writeUtil) }
		];
		for (let i = 0; i < readPool; i++) {
			units.push({
				label: i === 0 ? 'primário · leitura' : `réplica ${i} · leitura`,
				util: perReadUtil,
				level: bucket(perReadUtil)
			});
		}

		const replicationLagSeconds = writeUtil <= 0.8 ? 0 : (writeUtil - 0.8) * REP_LAG_SCALE;
		return {
			mode,
			units,
			reads: { util: readUtil, capacity: readCap },
			writes: { util: writeUtil, capacity: writeCap },
			replicationLagSeconds
		};
	}

	if (mode === 'sharded') {
		const S = shards(d);
		const skew = clamp01(d.skew ?? 0);
		const hs = 1 / S + skew * (1 - 1 / S);
		const coldShare = S > 1 ? (1 - hs) / (S - 1) : 0;
		const units: DbUnitStat[] = [];
		for (let i = 0; i < S; i++) {
			const share = i === 0 ? hs : coldShare;
			const u = util(offered * share, baseCap);
			units.push({
				label: i === 0 && skew > 0 ? `shard 1 (quente)` : `shard ${i + 1}`,
				util: u,
				level: bucket(u),
				hot: i === 0 && skew > 0
			});
		}
		return { mode, units };
	}

	const u = util(offered, baseCap);
	return { mode, units: [{ label: 'instância', util: u, level: bucket(u) }] };
}
