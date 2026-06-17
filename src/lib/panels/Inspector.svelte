<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import { ui } from '$lib/stores/ui.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { getDef } from '$lib/registry';

	const node = $derived(ui.selectedNode);
	const def = $derived(node ? getDef(node.data.kind) : null);

	function num(value: string, fallback = 0): number {
		const n = Number(value);
		return Number.isFinite(n) ? n : fallback;
	}
</script>

<aside class="flex h-full w-full flex-col gap-4 overflow-y-auto border-l bg-sidebar p-3">
	<h2 class="text-sm font-semibold">Propriedades</h2>

	{#if node && def}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span class="rounded bg-muted px-1.5 py-0.5">{def.label}</span>
			<span class="font-mono">{node.id}</span>
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for="f-label">Nome</Label>
			<Input
				id="f-label"
				value={node.data.label}
				oninput={(e) => graph.updateData(node.id, { label: e.currentTarget.value })}
			/>
		</div>

		{#if node.data.kind === 'service'}
			<div class="flex flex-col gap-1.5">
				<Label for="f-replicas">Réplicas</Label>
				<Input
					id="f-replicas"
					type="number"
					min="1"
					value={node.data.replicas}
					oninput={(e) => graph.updateData(node.id, { replicas: num(e.currentTarget.value, 1) })}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label for="f-lang">Linguagem</Label>
				<Input
					id="f-lang"
					value={node.data.language ?? ''}
					oninput={(e) => graph.updateData(node.id, { language: e.currentTarget.value })}
				/>
			</div>
		{:else if node.data.kind === 'database'}
			<div class="flex flex-col gap-1.5">
				<Label for="f-engine">Engine</Label>
				<select
					id="f-engine"
					class="h-9 rounded-md border bg-background px-2 text-sm"
					value={node.data.engine}
					onchange={(e) =>
						graph.updateData(node.id, {
							engine: e.currentTarget.value as 'postgres' | 'mysql' | 'mongo' | 'redis'
						})}
				>
					<option value="postgres">postgres</option>
					<option value="mysql">mysql</option>
					<option value="mongo">mongo</option>
					<option value="redis">redis</option>
				</select>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={node.data.persistent}
					onchange={(e) => graph.updateData(node.id, { persistent: e.currentTarget.checked })}
				/>
				Persistente
			</label>
		{:else if node.data.kind === 'api-gateway'}
			<div class="flex flex-col gap-1.5">
				<Label for="f-routes">Rotas</Label>
				<Input
					id="f-routes"
					type="number"
					min="0"
					value={node.data.routes}
					oninput={(e) => graph.updateData(node.id, { routes: num(e.currentTarget.value, 0) })}
				/>
			</div>
		{/if}

		<Separator />
		<Button variant="destructive" size="sm" onclick={() => graph.removeNode(node.id)}>
			Remover nó
		</Button>
	{:else}
		<p class="text-sm text-muted-foreground">Selecione um nó para editar suas propriedades.</p>
	{/if}
</aside>
