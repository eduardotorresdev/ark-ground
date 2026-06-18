<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import Copy from '@lucide/svelte/icons/copy';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { ui } from '$lib/stores/ui.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { getDef } from '$lib/registry';
	import type { ArchData, LbAlgorithm } from '$lib/registry/types';

	const node = $derived(ui.selectedNode);
	const def = $derived(node ? getDef(node.data.kind) : null);
	const isReplica = $derived(!!node?.parentId);
	const replicaCount = $derived(
		node?.data.kind === 'pool' ? graph.nodes.filter((n) => n.parentId === node.id).length : 0
	);

	function num(value: string, fallback = 0): number {
		const n = Number(value);
		return Number.isFinite(n) ? n : fallback;
	}

	function setScale(key: string, value: number) {
		if (!node) return;
		const v = Math.max(0, Math.round(value));
		if (key === '__pool__') {
			graph.setPoolCapacity(node.id, v);
			return;
		}
		graph.updateData(node.id, { [key]: v } as Partial<ArchData>);
	}

	function removeSelected() {
		if (!node) return;
		graph.removeNode(node.id);
		ui.select(null);
	}
</script>

{#snippet scale(id: string, label: string, value: number, key: string, max: number, step: number)}
	<div class="flex flex-col gap-1.5">
		<Label for={id}>{label}</Label>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="icon"
				class="size-8 shrink-0"
				aria-label="Diminuir"
				disabled={value <= 0}
				onclick={() => setScale(key, value - step)}
			>
				<Minus size={16} />
			</Button>
			<Input
				{id}
				type="number"
				min="0"
				{step}
				{value}
				class="flex-1 text-center"
				oninput={(e) => setScale(key, num(e.currentTarget.value, 0))}
			/>
			<Button
				variant="outline"
				size="icon"
				class="size-8 shrink-0"
				aria-label="Aumentar"
				disabled={value >= max}
				onclick={() => setScale(key, Math.min(max, value + step))}
			>
				<Plus size={16} />
			</Button>
		</div>
	</div>
{/snippet}

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
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 5000, 50)}
			<div class="flex flex-col gap-1.5">
				<Label for="f-lang">Linguagem</Label>
				<Input
					id="f-lang"
					value={node.data.language ?? ''}
					oninput={(e) => graph.updateData(node.id, { language: e.currentTarget.value })}
				/>
			</div>
			<Separator />
			{#if isReplica}
				<Button variant="outline" size="sm" onclick={() => graph.addReplica(node.parentId!)}>
					<Plus size={16} /> Adicionar réplica
				</Button>
			{:else}
				<Button
					variant="outline"
					size="sm"
					onclick={() => ui.select(graph.duplicateService(node.id))}
				>
					<Copy size={16} /> Duplicar (criar pool)
				</Button>
			{/if}
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
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 10000, 100)}
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={node.data.persistent}
					onchange={(e) => graph.updateData(node.id, { persistent: e.currentTarget.checked })}
				/>
				Persistente
			</label>
		{:else if node.data.kind === 'api-gateway'}
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 20000, 100)}
		{:else if node.data.kind === 'load'}
			{@render scale('f-rps', 'Carga (req/s)', node.data.rps, 'rps', 5000, 50)}
		{:else if node.data.kind === 'load-balancer'}
			<div class="flex flex-col gap-1.5">
				<Label for="f-algo">Algoritmo</Label>
				<select
					id="f-algo"
					class="h-9 rounded-md border bg-background px-2 text-sm"
					value={node.data.algorithm}
					onchange={(e) =>
						graph.updateData(node.id, { algorithm: e.currentTarget.value as LbAlgorithm })}
				>
					<option value="round-robin">round-robin (divide igual)</option>
					<option value="weighted">weighted (proporcional à capacidade)</option>
					<option value="least-connections">least-connections (equaliza utilização)</option>
				</select>
			</div>
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 200000, 1000)}
		{:else if node.data.kind === 'pool'}
			<div class="flex flex-col gap-1.5">
				<Label>Réplicas</Label>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						class="size-8"
						disabled={replicaCount <= 2}
						onclick={() => graph.removeLastReplica(node.id)}
					>
						<Minus size={16} />
					</Button>
					<span class="min-w-8 text-center text-sm font-medium tabular-nums">{replicaCount}</span>
					<Button
						variant="outline"
						size="icon"
						class="size-8"
						onclick={() => graph.addReplica(node.id)}
					>
						<Plus size={16} />
					</Button>
				</div>
			</div>
			{@render scale(
				'f-cap',
				'Capacidade por réplica (req/s)',
				node.data.capacity,
				'__pool__',
				5000,
				50
			)}
			<p class="text-xs text-muted-foreground">
				Capacidade total do pool = {(node.data.capacity * replicaCount).toLocaleString('pt-BR')} req/s
				({replicaCount} × {node.data.capacity}). Toda réplica herda essa capacidade.
			</p>
		{/if}

		<Separator />
		<Button variant="destructive" size="sm" onclick={() => removeSelected()}>
			{isReplica ? 'Remover réplica' : 'Remover nó'}
		</Button>
	{:else}
		<p class="text-sm text-muted-foreground">Selecione um nó para editar suas propriedades.</p>
	{/if}
</aside>
