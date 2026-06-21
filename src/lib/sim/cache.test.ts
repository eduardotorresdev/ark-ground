import { describe, it, expect } from 'vitest';
import { advanceWarmth, initialWarmth, sameCache, ttlRetention } from './cache';

describe('initialWarmth', () => {
	it('is cold (0) when the cache has a TTL, warm (1) otherwise', () => {
		expect(initialWarmth(30)).toBe(0);
		expect(initialWarmth(0)).toBe(1);
	});
});

describe('advanceWarmth', () => {
	it('pins warmth to 1 with no TTL (always warm = constant hit ratio)', () => {
		expect(advanceWarmth(0, 0, { warmth: 0 }, 1).warmth).toBe(1);
		expect(advanceWarmth(1000, 0, undefined, 1).warmth).toBe(1);
	});

	it('warms toward 1 under load, with the TTL as the time constant', () => {
		// from cold, one second with ttl=10 → 10% of the way to 1
		expect(advanceWarmth(1000, 10, { warmth: 0 }, 1).warmth).toBeCloseTo(0.1, 5);
	});

	it('decays toward 0 when idle', () => {
		expect(advanceWarmth(0, 10, { warmth: 1 }, 1).warmth).toBeCloseTo(0.9, 5);
	});

	it('clamps the step so a long frame cannot overshoot', () => {
		expect(advanceWarmth(1000, 10, { warmth: 0 }, 100).warmth).toBe(1);
		expect(advanceWarmth(0, 10, { warmth: 1 }, 100).warmth).toBe(0);
	});
});

describe('ttlRetention', () => {
	it('is 1 (no erosion) when expiry is not modeled', () => {
		expect(ttlRetention(1000, 0, 2000)).toBe(1); // ttl 0 = always warm
		expect(ttlRetention(1000, 30, 0)).toBe(1); // workingSet 0 = expiry off
		expect(ttlRetention(1000, 30, -5)).toBe(1);
	});

	it('follows (offered·ttl)/(offered·ttl + workingSet)', () => {
		// 1000 rps · 10 s = 10000 reqs/window vs 2000 keys → 10000/12000
		expect(ttlRetention(1000, 10, 2000)).toBeCloseTo(10000 / 12000, 6);
	});

	it('approaches 1 as load or TTL grows (each key re-hit before expiring)', () => {
		expect(ttlRetention(1e9, 30, 2000)).toBeGreaterThan(0.999);
		expect(ttlRetention(1000, 1e9, 2000)).toBeGreaterThan(0.999);
	});

	it('approaches 0 as the key space dwarfs the requests per window', () => {
		expect(ttlRetention(10, 1, 1e9)).toBeLessThan(0.001);
	});

	it('eases as load rises for a fixed TTL and key space', () => {
		expect(ttlRetention(100, 10, 2000)).toBeLessThan(ttlRetention(10000, 10, 2000));
	});

	it('treats undefined workingSet (legacy diagrams) as expiry off', () => {
		expect(ttlRetention(1000, 30, undefined as unknown as number)).toBe(1);
	});
});

describe('sameCache', () => {
	it('treats identical warmth as equal and any real step as different', () => {
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.5 } })).toBe(true);
		// a single integration step must register as different, even a tiny one —
		// otherwise the dirty-check swallows the ramp (see accumulation test below).
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.5005 } })).toBe(false);
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.6 } })).toBe(false);
		expect(sameCache({ a: { warmth: 0.5 } }, {})).toBe(false);
	});

	// Regression: with a long TTL the per-frame step is well under the old 0.005
	// threshold, so sameCache reported "no change" every frame and warmth froze
	// near 0 forever (a TTL-30s cache stuck "frio" with the backing taking 100%).
	// Drive the real sim-store loop — advance, then commit only when !sameCache —
	// and assert warmth actually climbs.
	it('lets warmth accumulate frame-by-frame through the dirty-check (long TTL)', () => {
		const ttl = 30;
		const dt = 1 / 60; // ~60fps frame
		let committed = { c: { warmth: initialWarmth(ttl) } };
		for (let i = 0; i < 60 * 60; i++) {
			// 60 s of frames
			const next = { c: advanceWarmth(1000, ttl, committed.c, dt) };
			if (!sameCache(next, committed)) committed = next;
		}
		// after ~2 time constants under load, a healthy cache should be well warm
		expect(committed.c.warmth).toBeGreaterThan(0.85);
	});
});
