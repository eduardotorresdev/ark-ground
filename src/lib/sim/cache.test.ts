import { describe, it, expect } from 'vitest';
import { advanceWarmth, initialWarmth, sameCache } from './cache';

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

describe('sameCache', () => {
	it('treats sub-threshold warmth changes as equal but flags real ones', () => {
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.5 } })).toBe(true);
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.501 } })).toBe(true);
		expect(sameCache({ a: { warmth: 0.5 } }, { a: { warmth: 0.6 } })).toBe(false);
		expect(sameCache({ a: { warmth: 0.5 } }, {})).toBe(false);
	});
});
