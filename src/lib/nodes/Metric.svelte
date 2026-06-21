<script lang="ts">
	import { sim } from '$lib/stores/sim.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';

	let { id }: { id: string } = $props();

	const stat = $derived(sim.nodeStat(id));
	const disp = $derived(sim.dispOf(id));
	const level = $derived(sim.level(id));
</script>

{#if stat && stat.capacity != null}
	{@const pct = Math.min(100, Math.round((disp.offered / stat.capacity) * 100))}
	<div
		class="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
		style:color={LEVEL_STROKE[level]}
		style:background-color="color-mix(in srgb, {LEVEL_STROKE[level]} 14%, transparent)"
	>
		<span class="size-1.5 rounded-full" style:background-color={LEVEL_STROKE[level]}></span>
		{pct}% · {Math.round(disp.served)}/{Math.round(stat.capacity)} rps
		{#if stat.dropped > 0.5}
			<span style:color={LEVEL_STROKE.crit}>−{Math.round(stat.dropped)}</span>
		{/if}
		{#if stat.blocked && stat.blocked > 0.5}
			<span style:color={LEVEL_STROKE.crit}>⊘{Math.round(stat.blocked)}</span>
		{/if}
	</div>
{/if}
