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
 * Reference time (seconds) for TTL-expiry erosion: a TTL equal to this keeps
 * half of the would-be hits, the rest expire and re-query the backing.
 */
const TTL_REF_SECONDS = 5;

/**
 * Steady-state hit-ratio retention from TTL expiry, in [0, 1].
 *
 * A per-entry TTL means data isn't kept forever: once it expires, the next
 * request re-queries the backing instead of hitting the cache. So a finite TTL
 * caps the achievable hit ratio below the configured ceiling — and the longer
 * the TTL, the longer data stays cached, the more requests are hits.
 *
 * Kept deliberately simple (a smooth curve in the TTL alone, no extra knobs):
 *     retention = ttl / (ttl + TTL_REF_SECONDS).
 * `ttlSeconds <= 0` means "never expires" → retention 1 (no erosion).
 */
export function ttlRetention(ttlSeconds: number): number {
	if (!(ttlSeconds > 0)) return 1;
	return ttlSeconds / (ttlSeconds + TTL_REF_SECONDS);
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
