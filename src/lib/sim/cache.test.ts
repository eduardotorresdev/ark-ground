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
	it('is 1 (no erosion) when TTL is 0 — never expires', () => {
		expect(ttlRetention(0)).toBe(1);
		expect(ttlRetention(-5)).toBe(1);
	});

	it('follows ttl/(ttl + 5)', () => {
		expect(ttlRetention(5)).toBeCloseTo(0.5, 6); // ttl == reference → half
		expect(ttlRetention(10)).toBeCloseTo(10 / 15, 6);
		expect(ttlRetention(30)).toBeCloseTo(30 / 35, 6);
	});

	it('longer TTL retains more; approaches 1 as TTL grows', () => {
		expect(ttlRetention(300)).toBeGreaterThan(ttlRetention(30));
		expect(ttlRetention(1e7)).toBeGreaterThan(0.999);
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
