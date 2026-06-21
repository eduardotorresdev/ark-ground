<script lang="ts">
	import { deploy } from '$lib/stores/deploy.svelte';
	import { sim } from '$lib/stores/sim.svelte';

	let { id, version }: { id: string; version: number } = $props();

	const run = $derived(deploy.runs[id]);
	const pct = $derived(run ? Math.round(deploy.progress(id, sim.now) * 100) : 0);
</script>

{#if run}
	<div
		class="mt-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 tabular-nums"
		title="deploy {run.strategy} → v{run.toVersion}"
	>
		⟳ deploy {run.strategy} → v{run.toVersion} · {pct}%
		<div class="mt-0.5 h-1 w-full overflow-hidden rounded bg-sky-200">
			<div class="h-full bg-sky-500 transition-[width]" style:width="{pct}%"></div>
		</div>
	</div>
{:else}
	<span
		class="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
	>
		v{version}
	</span>
{/if}
