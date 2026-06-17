<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import Download from '@lucide/svelte/icons/download';
	import Upload from '@lucide/svelte/icons/upload';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { sim } from '$lib/stores/sim.svelte';
	import { download, importFile } from '$lib/persistence/storage.svelte';

	let fileInput: HTMLInputElement;

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) await importFile(file);
		input.value = '';
		ui.select(null);
	}

	function clearAll() {
		graph.reset();
		ui.select(null);
	}
</script>

<header class="flex items-center gap-2 border-b bg-background px-3 py-2">
	<span class="mr-2 text-sm font-semibold">ark-ground</span>
	<span class="text-xs text-muted-foreground">simulador de arquiteturas</span>

	<div class="ml-auto flex items-center gap-2">
		<Button variant="outline" size="sm" onclick={download}>
			<Download size={16} /> Exportar
		</Button>
		<Button variant="outline" size="sm" onclick={() => fileInput.click()}>
			<Upload size={16} /> Importar
		</Button>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/json"
			class="hidden"
			onchange={onFile}
		/>
		<Button variant="outline" size="sm" onclick={clearAll}>
			<Trash2 size={16} /> Limpar
		</Button>
		<Separator orientation="vertical" class="h-5" />
		<Button size="sm" variant={sim.running ? 'secondary' : 'default'} onclick={() => sim.toggle()}>
			{#if sim.running}
				<Pause size={16} /> Pausar
			{:else}
				<Play size={16} /> Simular
			{/if}
		</Button>
	</div>
</header>
