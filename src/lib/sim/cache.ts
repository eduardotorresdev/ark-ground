/**
 * Cache warmth — the temporal side of a read-through cache's hit ratio.
 *
 * `computeSim` solves the steady-state *rate* of the cache each tick (it serves
 * `min(offered, capacity)` and splits that into hits/misses by the effective hit
 * ratio). On top of that rate, the *effective* hit ratio is the configured
 * `hitRatio` scaled by a `warmth` in [0, 1] that this module integrates over
 * time, exactly like the broker backlog or the synchronous in-flight queue:
 *  - `advanceWarmth(...)` integrates one cache's warmth forward by `dt` seconds.
 *  - the engine reads the snapshot to compute the effective hit ratio.
 *
 * With `ttlSeconds = 0` the cache is always warm (warmth pinned to 1 → constant
 * hit ratio). With `ttlSeconds > 0` it starts cold and warms toward 1 as traffic
 * populates it, and decays toward 0 as entries expire when traffic subsides. The
 * TTL is the time constant of both ramps, so a longer TTL warms and cools slower.
 */

const EPS = 1e-6;

/** Persisted warmth for one cache, between frames. */
export type CacheRuntime = { warmth: number };

/** Per-cache hit/miss stats for display (computed by the engine each tick). */
export type CacheStat = {
	/** req/s answered from cache (served · effective hit ratio) */
	hits: number;
	/** req/s forwarded to the backing (served · (1 − effective hit ratio)) */
	misses: number;
	/** effective hit ratio actually applied this tick = configured · warmth */
	hitRatio: number;
	/** temporal warmth in [0, 1]; 1 = fully warm */
	warmth: number;
};

/**
 * Integrate one cache's warmth forward by `dt` seconds (exponential approach).
 * Warmth heads toward 1 while the cache receives load and toward 0 when it goes
 * idle, with time constant `ttlSeconds`. `ttlSeconds <= 0` means "always warm".
 */
export function advanceWarmth(
	offered: number,
	ttlSeconds: number,
	prev: CacheRuntime | undefined,
	dt: number
): CacheRuntime {
	if (!(ttlSeconds > 0)) return { warmth: 1 };
	const target = offered > EPS ? 1 : 0;
	const cur = prev?.warmth ?? 0;
	const next = cur + (target - cur) * Math.min(1, dt / ttlSeconds);
	return { warmth: clamp01(next) };
}

/** Warmth when no runtime state exists yet: cold if it has a TTL, else warm. */
export function initialWarmth(ttlSeconds: number): number {
	return ttlSeconds > 0 ? 0 : 1;
}

function clamp01(v: number): number {
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
}

/**
 * Shallow equality of two warmth maps, to skip needless recomputes once warmth
 * has settled. The epsilon must stay *below* the per-frame integration step
 * `(target − cur)·(dt/ttl)` — otherwise a slow ramp (long TTL, small dt) never
 * clears the threshold and warmth freezes near its starting value instead of
 * accumulating toward the target. `EPS` is well under any realistic step.
 */
export function sameCache(
	a: Record<string, CacheRuntime>,
	b: Record<string, CacheRuntime>
): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	for (const id of ak) {
		const bw = b[id];
		if (!bw) return false;
		if (Math.abs((a[id]?.warmth ?? 0) - bw.warmth) > EPS) return false;
	}
	return true;
}
