<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import Download from '@lucide/svelte/icons/download';
	import Upload from '@lucide/svelte/icons/upload';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import BoxSelect from '@lucide/svelte/icons/box-select';
	import { graph } from '$lib/stores/graph.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { LEVEL_STROKE } from '$lib/sim/engine';
	import { download, importFile } from '$lib/persistence/storage.svelte';

	let fileInput: HTMLInputElement;

	const legend = [
		{ level: 'ok' as const, label: '≤70%' },
		{ level: 'warn' as const, label: '70–100%' },
		{ level: 'crit' as const, label: '>100%' }
	];

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

	<div class="ml-3 hidden items-center gap-2.5 text-[11px] text-muted-foreground sm:flex">
		{#each legend as l (l.level)}
			<span class="inline-flex items-center gap-1">
				<span class="size-2 rounded-full" style:background-color={LEVEL_STROKE[l.level]}></span>
				{l.label}
			</span>
		{/each}
	</div>

	<div class="ml-auto flex items-center gap-2">
		<Button
			variant={ui.showQuanta ? 'default' : 'outline'}
			size="sm"
			onclick={() => ui.toggleQuanta()}
		>
			<BoxSelect size={16} /> Quanta
		</Button>
		<Separator orientation="vertical" class="h-5" />
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
		<Separator orientation="vertical" class="h-5" />
		<Button variant="outline" size="sm" onclick={clearAll}>
			<Trash2 size={16} /> Limpar
		</Button>
	</div>
</header>
