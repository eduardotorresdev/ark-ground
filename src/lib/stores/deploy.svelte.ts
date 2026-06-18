import { graph } from './graph.svelte';
import { capMultiplier } from '$lib/sim/deployMath';
import type { ArchData, DeployStrategy } from '$lib/registry/types';

export type DeployRun = {
	nodeId: string;
	strategy: DeployStrategy;
	fromVersion: number;
	toVersion: number;
	/** performance.now() timestamp when the deploy started */
	startMs: number;
	durationMs: number;
};

function versionOf(id: string): number {
	const d = graph.nodes.find((n) => n.id === id)?.data as { version?: number } | undefined;
	return d?.version ?? 1;
}

/**
 * Tracks in-flight deploys. Runs are ephemeral (never serialized): a deploy
 * mid-flight does not survive a reload. The resulting `version` bump lives in
 * node data and is persisted.
 */
class DeployStore {
	runs = $state<Record<string, DeployRun>>({});

	start(nodeId: string, strategy: DeployStrategy, durationMs: number) {
		if (this.runs[nodeId]) return;
		const from = versionOf(nodeId);
		this.runs = {
			...this.runs,
			[nodeId]: {
				nodeId,
				strategy,
				fromVersion: from,
				toVersion: from + 1,
				startMs: performance.now(),
				durationMs
			}
		};
	}

	isDeploying(id: string): boolean {
		return id in this.runs;
	}

	progress(id: string, nowMs: number): number {
		const r = this.runs[id];
		if (!r) return 0;
		return Math.min(1, Math.max(0, (nowMs - r.startMs) / r.durationMs));
	}

	/** Capacity multipliers for every active deploy, keyed by node id. */
	multipliers(): Record<string, number> {
		const out: Record<string, number> = {};
		for (const run of Object.values(this.runs)) {
			const replicas = graph.nodes.filter((n) => n.parentId === run.nodeId).length || 1;
			out[run.nodeId] = capMultiplier(run.strategy, replicas);
		}
		return out;
	}

	/** Finish any run past its duration, bumping the node's version. */
	settle(nowMs: number) {
		const done = Object.values(this.runs).filter((r) => nowMs - r.startMs >= r.durationMs);
		if (!done.length) return;
		const next = { ...this.runs };
		for (const run of done) {
			graph.updateData(run.nodeId, { version: run.toVersion } as Partial<ArchData>);
			delete next[run.nodeId];
		}
		this.runs = next;
	}
}

export const deploy = new DeployStore();
