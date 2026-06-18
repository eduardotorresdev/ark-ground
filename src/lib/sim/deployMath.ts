import type { DeployStrategy } from '$lib/registry/types';

/**
 * Effective-capacity multiplier for a node mid-deploy, given elapsed time.
 *  - recreate:   0 for the whole window (full downtime, requests dropped).
 *  - blue-green: 1 (a parallel replica absorbs traffic; zero downtime).
 *                The 2× resource cost is shown in the UI, not modeled here.
 *  - rolling:    (R-1)/R — one replica out at a time, partial capacity.
 */
export function capMultiplier(strategy: DeployStrategy, replicaCount: number): number {
	switch (strategy) {
		case 'recreate':
			return 0;
		case 'blue-green':
			return 1;
		case 'rolling': {
			const r = Math.max(replicaCount, 1);
			return (r - 1) / r;
		}
	}
}
