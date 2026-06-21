<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Button } from '$lib/components/ui/button';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import { applyPreset } from '$lib/presets';
	import type { PresetEntry } from '$lib/presets/library';

	let { entry, onClose }: { entry: PresetEntry | null; onClose: () => void } = $props();

	let replace = $state(false);

	// Controlled open state: the dialog is open whenever a preset is selected.
	const open = $derived(entry !== null);

	function close() {
		replace = false;
		onClose();
	}

	function onOpenChange(next: boolean) {
		if (!next) close();
	}

	function confirm() {
		if (!entry) return;
		applyPreset(entry.preset, { mode: replace ? 'replace' : 'merge' });
		close();
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-4 shadow-lg"
		>
			{#if entry}
				<div class="flex items-center gap-2">
					<BrandIcon icon={entry.icon} size={20} />
					<Dialog.Title class="text-sm font-semibold">{entry.preset.meta.name}</Dialog.Title>
				</div>
				{#if entry.preset.meta.description}
					<Dialog.Description class="mt-1 text-xs text-muted-foreground">
						{entry.preset.meta.description}
					</Dialog.Description>
				{/if}

				<label class="mt-4 flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={replace} />
					Substituir o canvas atual
				</label>

				<div class="mt-4 flex justify-end gap-2">
					<Button variant="ghost" onclick={close}>Cancelar</Button>
					<Button onclick={confirm}>{replace ? 'Substituir' : 'Adicionar'}</Button>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
