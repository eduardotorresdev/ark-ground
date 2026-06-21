/**
 * Cache hit-ratio dynamics — the temporal and TTL-expiry sides of a read-through
 * cache.
 *
 * `computeSim` solves the steady-state *rate* of the cache each tick (it serves
 * `min(offered, capacity)` and splits that into hits/misses by the effective hit
 * ratio). The *effective* hit ratio is the configured `hitRatio` scaled by two
 * factors this module supplies:
 *
 *  1. `warmth` ∈ [0, 1] — the transient "is the cache populated yet?" state,
 *     integrated over time like the broker backlog or the sync in-flight queue:
 *       - `advanceWarmth(...)` integrates one cache's warmth forward by `dt`.
 *     With `ttlSeconds = 0` warmth is pinned to 1. With `ttlSeconds > 0` it
 *     starts cold and warms toward 1 as traffic populates it, decaying toward 0
 *     when traffic subsides. The TTL is the time constant of both ramps.
 *
 *  2. `ttlRetention(...)` ∈ [0, 1] — the *steady-state* erosion from per-entry
 *     expiry. A finite TTL means a populated cache still keeps re-fetching from
 *     the backing as entries expire, so even fully warm the achievable hit ratio
 *     sits below the configured ceiling. Solved each tick from the offered rate
 *     (no integration needed — it is the equilibrium, smoothed in time by warmth).
 *
 * So the engine applies `effectiveHit = hitRatio · warmth · ttlRetention`.
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
	/** effective hit ratio actually applied this tick = configured · warmth · ttlRetention */
	hitRatio: number;
	/** temporal warmth in [0, 1]; 1 = fully warm (populated) */
	warmth: number;
	/** steady-state retention from TTL expiry in [0, 1]; 1 = no expiry erosion */
	ttlRetention: number;
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

/**
 * Steady-state hit-ratio retention from TTL expiry, in [0, 1].
 *
 * A per-entry TTL means a hot key isn't kept forever: each entry lives
 * `ttlSeconds` after it is fetched, then expires, and the next request for it
 * misses and re-queries the backing. So a finite TTL caps the achievable hit
 * ratio below the configured ceiling, and the cap depends on how often each key
 * is re-requested *within* its TTL window.
 *
 * Modeling the `workingSet` distinct hot keys as Poisson arrivals, the per-key
 * rate is `offered / workingSet`, and the classic TTL-cache result `rT/(1+rT)`
 * gives a retained-hit fraction of
 *     (offered · ttl) / (offered · ttl + workingSet).
 * `offered · ttl` is how many requests arrive per TTL window: when it dwarfs the
 * key count each key is re-hit before expiring (retention → 1); when keys
 * outnumber requests-per-window most accesses land on an expired entry and
 * re-fetch (retention → 0). Higher load or longer TTL ⇒ less erosion.
 *
 * `ttlSeconds <= 0` (always warm) or `workingSet <= 0` (expiry not modeled)
 * disable erosion and return 1.
 */
export function ttlRetention(offered: number, ttlSeconds: number, workingSet: number): number {
	if (!(ttlSeconds > 0)) return 1;
	if (!(workingSet > 0)) return 1;
	const reqsPerWindow = Math.max(0, offered) * ttlSeconds;
	return reqsPerWindow / (reqsPerWindow + workingSet);
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
