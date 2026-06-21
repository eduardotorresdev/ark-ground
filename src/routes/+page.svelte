<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import Toolbar from '$lib/panels/Toolbar.svelte';
	import Sidebar from '$lib/panels/Sidebar.svelte';
	import Inspector from '$lib/panels/Inspector.svelte';
	import Editor from '$lib/canvas/Editor.svelte';
	import { startAutosave } from '$lib/persistence/storage.svelte';
	import { startHistory } from '$lib/stores/history.svelte';
	import { sim } from '$lib/stores/sim.svelte';

	onMount(() => {
		const stopSave = startAutosave();
		// start history after the saved diagram is loaded, so the initial
		// snapshot is the restored graph rather than an empty canvas.
		const stopHistory = startHistory();
		const stopSim = sim.start();
		return () => {
			stopSave();
			stopHistory();
			stopSim();
		};
	});
</script>

<svelte:head>
	<title>ark-ground · simulador de arquiteturas</title>
</svelte:head>

<div class="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
	<Toolbar />
	<div class="grid grid-cols-[16rem_1fr_18rem] overflow-hidden">
		<Sidebar />
		<SvelteFlowProvider>
			<Editor />
		</SvelteFlowProvider>
		<Inspector />
	</div>
</div>
