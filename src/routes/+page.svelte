<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import Toolbar from '$lib/panels/Toolbar.svelte';
	import Palette from '$lib/panels/Palette.svelte';
	import Inspector from '$lib/panels/Inspector.svelte';
	import Editor from '$lib/canvas/Editor.svelte';
	import { startAutosave } from '$lib/persistence/storage.svelte';

	onMount(() => startAutosave());
</script>

<svelte:head>
	<title>ark-ground · simulador de arquiteturas</title>
</svelte:head>

<div class="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
	<Toolbar />
	<div class="grid grid-cols-[14rem_1fr_18rem] overflow-hidden">
		<Palette />
		<SvelteFlowProvider>
			<Editor />
		</SvelteFlowProvider>
		<Inspector />
	</div>
</div>
