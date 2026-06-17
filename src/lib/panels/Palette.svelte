<script lang="ts">
	import { palette } from '$lib/registry';
	import type { NodeDef } from '$lib/registry/types';
	import { DND_MIME } from '$lib/canvas/dnd';

	// group definitions by category, preserving registry order
	const groups = $derived.by(() => {
		const acc: Record<string, NodeDef[]> = {};
		for (const def of palette) {
			(acc[def.category] ??= []).push(def);
		}
		return Object.entries(acc);
	});

	function onDragStart(event: DragEvent, kind: string) {
		event.dataTransfer?.setData(DND_MIME, kind);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}
</script>

<aside class="flex h-full w-full flex-col gap-4 overflow-y-auto border-r bg-sidebar p-3">
	<div>
		<h2 class="text-sm font-semibold">Componentes</h2>
		<p class="text-xs text-muted-foreground">Arraste para o canvas</p>
	</div>

	{#each groups as [category, defs] (category)}
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{category}
			</span>
			{#each defs as def (def.kind)}
				{@const Icon = def.icon}
				<button
					type="button"
					draggable="true"
					ondragstart={(e) => onDragStart(e, def.kind)}
					class={[
						'flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent active:cursor-grabbing',
						def.accent
					]}
				>
					<Icon size={16} />
					<span class="font-medium text-foreground">{def.label}</span>
				</button>
			{/each}
		</div>
	{/each}
</aside>
