<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import Copy from '@lucide/svelte/icons/copy';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Split from '@lucide/svelte/icons/split';
	import X from '@lucide/svelte/icons/x';
	import { ui } from '$lib/stores/ui.svelte';
	import { graph } from '$lib/stores/graph.svelte';
	import { deploy } from '$lib/stores/deploy.svelte';
	import { sim } from '$lib/stores/sim.svelte';
	import { getDef } from '$lib/registry';
	import { DEFAULT_GATEWAY_WEIGHT } from '$lib/sim/engine';
	import { effectiveDbCapacity } from '$lib/sim/database';
	import IconSelect from '$lib/components/IconSelect.svelte';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import { ENGINES, LANGUAGES, type EngineId } from '$lib/registry/icons';
	import { DB_MODES, dbModeOption } from '$lib/registry/db-modes';
	import { amplificationOf, isSyncKind } from '$lib/sim/syncqueue';
	import type {
		ArchData,
		BrokerFullPolicy,
		BrokerMode,
		DeployStrategy,
		LbAlgorithm
	} from '$lib/registry/types';

	const node = $derived(ui.selectedNode);

	// Synchronous in-flight queue for the selected node (when it builds backlog).
	const syncStat = $derived(node ? sim.syncStat(node.id) : undefined);

	// Edge selection: amplification factor for synchronous call edges.
	const selectedEdge = $derived(
		ui.selectedEdgeId ? (graph.edges.find((e) => e.id === ui.selectedEdgeId) ?? null) : null
	);
	const edgeAmp = $derived(selectedEdge ? amplificationOf(selectedEdge) : 1);
	const edgeKinds = $derived.by(() => {
		if (!selectedEdge) return null;
		const src = graph.nodes.find((n) => n.id === selectedEdge.source)?.data.kind;
		const dst = graph.nodes.find((n) => n.id === selectedEdge.target)?.data.kind;
		return src && dst ? { src, dst } : null;
	});
	// Amplification only makes sense for a synchronous *call*: a service/monolith/
	// pool reaching a synchronous callee (not a broker publish, not a load source).
	const showAmp = $derived(
		!!edgeKinds &&
			(edgeKinds.src === 'service' || edgeKinds.src === 'monolith' || edgeKinds.src === 'pool') &&
			isSyncKind(edgeKinds.dst)
	);
	function setAmp(value: number) {
		if (!selectedEdge) return;
		graph.updateEdgeData(selectedEdge.id, { amplification: Math.max(1, Math.round(value)) });
	}

	// Broker: live backlog stats (per consumer in topic mode) read from the sim.
	const brokerStat = $derived(
		node?.data.kind === 'broker' ? sim.nodeStat(node.id)?.broker : undefined
	);
	// Cache: live hit/miss/warmth stats read from the sim.
	const cacheStat = $derived(node?.data.kind === 'cache' ? sim.cacheStat(node.id) : undefined);
	function consumerLabel(consumerId: string): string {
		return graph.nodes.find((n) => n.id === consumerId)?.data.label ?? consumerId;
	}
	function fmtLag(s: number): string {
		if (!(s > 0)) return '0s';
		if (!Number.isFinite(s)) return '∞';
		return s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
	}

	// API gateway routing: each connected target gets a configurable share of the
	// load. Weights are relative; the displayed % is the normalized proportion.
	const gatewayTargets = $derived.by(() => {
		if (node?.data.kind !== 'api-gateway') return [];
		const weights = node.data.weights ?? {};
		const targets = graph.edges
			.filter((e) => e.source === node.id)
			.map((e) => graph.nodes.find((n) => n.id === e.target))
			.filter((n): n is NonNullable<typeof n> => !!n);
		const total = targets.reduce((s, t) => s + (weights[t.id] ?? DEFAULT_GATEWAY_WEIGHT), 0);
		return targets.map((t) => {
			const weight = weights[t.id] ?? DEFAULT_GATEWAY_WEIGHT;
			return {
				id: t.id,
				label: t.data.label,
				weight,
				pct: total > 0 ? Math.round((weight / total) * 100) : 0
			};
		});
	});

	function setWeight(targetId: string, value: number) {
		if (node?.data.kind !== 'api-gateway') return;
		const weights = { ...(node.data.weights ?? {}), [targetId]: Math.max(0, Math.round(value)) };
		graph.updateData(node.id, { weights });
	}
	// Database scaling: effective (bottleneck) capacity, given the current mode.
	// These guarded deriveds let the +/- closures read counts without re-narrowing.
	const dbEffective = $derived(
		node?.data.kind === 'database'
			? Math.round(effectiveDbCapacity(node.data, node.data.capacity))
			: 0
	);
	const dbReplicas = $derived(node?.data.kind === 'database' ? (node.data.replicaCount ?? 2) : 2);
	const dbShards = $derived(node?.data.kind === 'database' ? (node.data.shardCount ?? 2) : 2);

	const def = $derived(node ? getDef(node.data.kind) : null);
	const isReplica = $derived(!!node?.parentId);
	const replicaCount = $derived(
		node?.data.kind === 'pool' ? graph.nodes.filter((n) => n.parentId === node.id).length : 0
	);

	// Which nodes can be deployed, and with which strategies.
	const deployable = $derived(
		!!node &&
			!isReplica &&
			(node.data.kind === 'service' || node.data.kind === 'monolith' || node.data.kind === 'pool')
	);
	const strategies = $derived<DeployStrategy[]>(
		node?.data.kind === 'pool' ? ['recreate', 'blue-green', 'rolling'] : ['recreate', 'blue-green']
	);
	let strategy = $state<DeployStrategy>('recreate');
	let durationSec = $state(3);
	const version = $derived(
		node && 'version' in node.data ? (node.data as { version: number }).version : 1
	);
	const deploying = $derived(!!node && deploy.isDeploying(node.id));
	const deployPct = $derived(node ? Math.round(deploy.progress(node.id, sim.now) * 100) : 0);

	function startDeploy() {
		if (!node) return;
		deploy.start(node.id, strategy, durationSec * 1000);
	}

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
				<Label>Linguagem</Label>
				<IconSelect
					value={node.data.language}
					options={LANGUAGES}
					placeholder="Escolher linguagem…"
					onChange={(language) => graph.updateData(node.id, { language })}
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
				<Label>Engine</Label>
				<div class="grid grid-cols-2 gap-1.5">
					{#each ENGINES as eng (eng.id)}
						<Button
							variant={node.data.engine === eng.id ? 'default' : 'outline'}
							size="sm"
							class="justify-start gap-2"
							onclick={() => graph.updateData(node.id, { engine: eng.id as EngineId })}
						>
							<BrandIcon
								icon={eng.icon}
								size={16}
								color={node.data.engine === eng.id ? 'currentColor' : undefined}
							/>
							{eng.label}
						</Button>
					{/each}
				</div>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label>Modo</Label>
				<div class="grid grid-cols-3 gap-1.5">
					{#each DB_MODES as m (m.id)}
						{@const active = (node.data.mode ?? 'single') === m.id}
						<Button
							variant={active ? 'default' : 'outline'}
							size="sm"
							class="h-auto flex-col gap-1 py-2"
							onclick={() => graph.updateData(node.id, { mode: m.id })}
						>
							<m.icon size={18} />
							<span class="text-xs">{m.label}</span>
						</Button>
					{/each}
				</div>
				<p class="text-xs text-muted-foreground">
					{dbModeOption(node.data.mode).description}
				</p>
			</div>
			{@render scale(
				'f-cap',
				'Capacidade por instância (req/s)',
				node.data.capacity,
				'capacity',
				10000,
				100
			)}
			{#if (node.data.mode ?? 'single') === 'replicas'}
				<div class="flex flex-col gap-1.5">
					<Label>Réplicas de leitura</Label>
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							aria-label="Diminuir réplicas"
							disabled={dbReplicas <= 1}
							onclick={() =>
								graph.updateData(node.id, { replicaCount: Math.max(1, dbReplicas - 1) })}
						>
							<Minus size={16} />
						</Button>
						<span class="min-w-8 text-center text-sm font-medium tabular-nums">
							{dbReplicas}
						</span>
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							aria-label="Aumentar réplicas"
							onclick={() => graph.updateData(node.id, { replicaCount: dbReplicas + 1 })}
						>
							<Plus size={16} />
						</Button>
					</div>
				</div>
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between gap-2">
						<Label for="f-readratio">Leituras</Label>
						<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
							{Math.round((node.data.readRatio ?? 0.8) * 100)}% leitura · {Math.round(
								(1 - (node.data.readRatio ?? 0.8)) * 100
							)}% escrita
						</span>
					</div>
					<input
						id="f-readratio"
						type="range"
						min="0"
						max="100"
						step="1"
						value={Math.round((node.data.readRatio ?? 0.8) * 100)}
						class="w-full"
						oninput={(e) =>
							graph.updateData(node.id, { readRatio: num(e.currentTarget.value, 80) / 100 })}
					/>
				</div>
				<p class="text-xs text-muted-foreground">
					Leitura: {node.data.capacity} × {(node.data.replicaCount ?? 2) + 1} (primário + réplicas) =
					{(node.data.capacity * ((node.data.replicaCount ?? 2) + 1)).toLocaleString('pt-BR')} req/s.
					Escrita: {node.data.capacity.toLocaleString('pt-BR')} req/s (só primário). Capacidade efetiva
					≈ {dbEffective.toLocaleString('pt-BR')} req/s. O lag de replicação cresce quando o primário
					enche.
				</p>
			{:else if (node.data.mode ?? 'single') === 'sharded'}
				<div class="flex flex-col gap-1.5">
					<Label>Shards</Label>
					<div class="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							aria-label="Diminuir shards"
							disabled={dbShards <= 1}
							onclick={() => graph.updateData(node.id, { shardCount: Math.max(1, dbShards - 1) })}
						>
							<Minus size={16} />
						</Button>
						<span class="min-w-8 text-center text-sm font-medium tabular-nums">
							{dbShards}
						</span>
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							aria-label="Aumentar shards"
							onclick={() => graph.updateData(node.id, { shardCount: dbShards + 1 })}
						>
							<Plus size={16} />
						</Button>
					</div>
				</div>
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between gap-2">
						<Label for="f-skew">Skew (shard quente)</Label>
						<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
							{Math.round((node.data.skew ?? 0) * 100)}%
						</span>
					</div>
					<input
						id="f-skew"
						type="range"
						min="0"
						max="100"
						step="1"
						value={Math.round((node.data.skew ?? 0) * 100)}
						class="w-full"
						oninput={(e) =>
							graph.updateData(node.id, { skew: num(e.currentTarget.value, 0) / 100 })}
					/>
				</div>
				<p class="text-xs text-muted-foreground">
					Total ≈ {node.data.capacity} × {node.data.shardCount ?? 2} =
					{(node.data.capacity * (node.data.shardCount ?? 2)).toLocaleString('pt-BR')} req/s. O skew concentra
					a carga num shard quente, derrubando a capacidade efetiva para ≈
					{dbEffective.toLocaleString('pt-BR')} req/s enquanto os outros ficam ociosos.
				</p>
			{/if}
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
			<Separator />
			<div class="flex flex-col gap-2">
				<Label>Distribuição de carga</Label>
				{#if gatewayTargets.length}
					<p class="text-xs text-muted-foreground">
						Proporção do tráfego roteada para cada destino conectado.
					</p>
					{#each gatewayTargets as t (t.id)}
						<div class="flex flex-col gap-1">
							<div class="flex items-center justify-between gap-2 text-xs">
								<span class="truncate font-medium">{t.label}</span>
								<span class="shrink-0 tabular-nums text-muted-foreground">{t.pct}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="100"
								step="1"
								value={t.weight}
								class="w-full"
								oninput={(e) => setWeight(t.id, num(e.currentTarget.value, 0))}
							/>
						</div>
					{/each}
				{:else}
					<p class="text-xs text-muted-foreground">
						Conecte o gateway a serviços para configurar a distribuição.
					</p>
				{/if}
			</div>
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
		{:else if node.data.kind === 'monolith'}
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 10000, 50)}
			<div class="flex flex-col gap-1.5">
				<Label>Linguagem</Label>
				<IconSelect
					value={node.data.language}
					options={LANGUAGES}
					placeholder="Escolher linguagem…"
					onChange={(language) => graph.updateData(node.id, { language })}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label>Módulos</Label>
				{#each node.data.modules as m (m.id)}
					<div class="flex items-center gap-1.5">
						<Input
							value={m.label}
							class="flex-1"
							oninput={(e) => graph.renameModule(node.id, m.id, e.currentTarget.value)}
						/>
						<Button
							variant="outline"
							size="icon"
							class="size-8 shrink-0"
							aria-label="Remover módulo"
							onclick={() => graph.removeModule(node.id, m.id)}
						>
							<X size={16} />
						</Button>
					</div>
				{/each}
				<Button variant="outline" size="sm" onclick={() => graph.addModule(node.id)}>
					<Plus size={16} /> Módulo
				</Button>
			</div>
			<Separator />
			<Button
				variant="outline"
				size="sm"
				onclick={() => ui.select(graph.duplicateMonolith(node.id))}
			>
				<Copy size={16} /> Duplicar (criar pool)
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={node.data.modules.length < 2}
				title={node.data.modules.length < 2 ? 'Adicione ao menos 2 módulos' : undefined}
				onclick={() => ui.select(graph.monolithToMicroservices(node.id))}
			>
				<Split size={16} /> Converter em microsserviços
			</Button>
		{:else if node.data.kind === 'broker'}
			<div class="flex flex-col gap-1.5">
				<Label for="f-mode">Modo de entrega</Label>
				<select
					id="f-mode"
					class="h-9 rounded-md border bg-background px-2 text-sm"
					value={node.data.mode}
					onchange={(e) => graph.updateData(node.id, { mode: e.currentTarget.value as BrokerMode })}
				>
					<option value="work-queue">fila de trabalho (consumidores competem)</option>
					<option value="topic">tópico (fan-out para todos)</option>
				</select>
			</div>
			{@render scale(
				'f-buf',
				'Tamanho do buffer (quanta)',
				node.data.bufferSize,
				'bufferSize',
				1000000,
				1000
			)}
			{@render scale(
				'f-deliv',
				'Taxa máx. de entrega (req/s)',
				node.data.maxDeliveryRate,
				'maxDeliveryRate',
				200000,
				500
			)}
			<div class="flex flex-col gap-1.5">
				<Label for="f-policy">Buffer cheio</Label>
				<select
					id="f-policy"
					class="h-9 rounded-md border bg-background px-2 text-sm"
					value={node.data.fullPolicy}
					onchange={(e) =>
						graph.updateData(node.id, { fullPolicy: e.currentTarget.value as BrokerFullPolicy })}
				>
					<option value="drop">descarte (o broker perde mensagens)</option>
					<option value="backpressure">backpressure (freia o produtor)</option>
				</select>
			</div>
			{#if brokerStat}
				<Separator />
				<div class="flex flex-col gap-1.5">
					<Label>Backlog por consumidor</Label>
					{#if brokerStat.perConsumer.length}
						{#each brokerStat.perConsumer as c (c.edgeId)}
							<div class="flex items-center justify-between gap-2 text-xs">
								<span class="truncate font-medium">{consumerLabel(c.consumerId)}</span>
								<span class="shrink-0 tabular-nums text-muted-foreground">
									{Math.round(c.backlog).toLocaleString('pt-BR')} msg · {fmtLag(c.lagSeconds)}
								</span>
							</div>
						{/each}
					{:else}
						<p class="text-xs text-muted-foreground">Conecte consumidores para ver o lag.</p>
					{/if}
				</div>
			{/if}
		{:else if node.data.kind === 'cache'}
			{@render scale('f-cap', 'Capacidade (req/s)', node.data.capacity, 'capacity', 100000, 500)}
			<div class="flex flex-col gap-1.5">
				<Label for="f-hit">Hit ratio</Label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						id="f-hit"
						min="0"
						max="100"
						step="1"
						value={Math.round(node.data.hitRatio * 100)}
						class="flex-1"
						oninput={(e) =>
							graph.updateData(node.id, { hitRatio: num(e.currentTarget.value, 0) / 100 })}
					/>
					<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
						{Math.round(node.data.hitRatio * 100)}%
					</span>
				</div>
				<p class="text-xs text-muted-foreground">
					Fração da carga servida pelo cache (hit). O resto (miss) vai ao backing a jusante.
				</p>
			</div>
			{@render scale(
				'f-ttl',
				'TTL (s) · 0 = sempre quente',
				node.data.ttlSeconds,
				'ttlSeconds',
				600,
				5
			)}
			{#if node.data.ttlSeconds > 0}
				<p class="text-xs text-muted-foreground">
					Com TTL &gt; 0 o cache começa frio e aquece com a carga (constante de tempo ~TTL). Além
					disso, entradas expiram: parte dos acessos re-consulta o backing mesmo quente, corroendo o
					hit ratio efetivo — quanto menor o TTL ou maior o working set, mais forte a erosão.
				</p>
				{@render scale(
					'f-ws',
					'Working set (chaves) · 0 = sem expiração',
					node.data.workingSet,
					'workingSet',
					100000,
					100
				)}
				<p class="text-xs text-muted-foreground">
					Chaves quentes distintas. Comparadas às requisições por janela de TTL (carga × TTL),
					definem quanto a expiração derruba o hit ratio: poucas chaves p/ muita carga ≈ sem perda;
					muitas chaves ≈ quase tudo re-consulta a fonte.
				</p>
			{/if}
			{#if cacheStat}
				<Separator />
				<div class="flex flex-col gap-1.5">
					<Label>Hit / miss</Label>
					<p class="text-xs text-muted-foreground tabular-nums">
						{Math.round(cacheStat.hits).toLocaleString('pt-BR')} hit/s · {Math.round(
							cacheStat.misses
						).toLocaleString('pt-BR')} miss/s · hit efetivo {Math.round(cacheStat.hitRatio * 100)}%
						(warmth {Math.round(cacheStat.warmth * 100)}%{node.data.kind === 'cache' &&
						node.data.ttlSeconds > 0 &&
						node.data.workingSet > 0
							? ` · retenção TTL ${Math.round(cacheStat.ttlRetention * 100)}%`
							: ''})
					</p>
				</div>
			{/if}
		{/if}

		{#if syncStat && syncStat.queue > 0.5}
			<Separator />
			<div class="flex flex-col gap-1.5">
				<Label>Fila síncrona</Label>
				<p class="text-xs text-muted-foreground">
					{Math.round(syncStat.queue).toLocaleString('pt-BR')} req em voo · latência {fmtLag(
						syncStat.latencySeconds
					)}
				</p>
			</div>
		{/if}

		{#if deployable && node}
			<Separator />
			<div class="flex flex-col gap-1.5">
				<Label>Deploy · versão atual v{version}</Label>
				{#if deploying}
					<div class="rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-700">
						deploy {deploy.runs[node.id]?.strategy} em andamento · {deployPct}%
						<div class="mt-1 h-1.5 w-full overflow-hidden rounded bg-sky-200">
							<div class="h-full bg-sky-500" style:width="{deployPct}%"></div>
						</div>
					</div>
				{:else}
					<select class="h-9 rounded-md border bg-background px-2 text-sm" bind:value={strategy}>
						{#each strategies as s (s)}
							<option value={s}>{s}</option>
						{/each}
					</select>
					<div class="flex items-center gap-2">
						<input type="range" min="1" max="10" step="1" bind:value={durationSec} class="flex-1" />
						<span class="w-10 text-right text-xs tabular-nums text-muted-foreground"
							>{durationSec}s</span
						>
					</div>
					<Button variant="default" size="sm" onclick={startDeploy}>
						<Rocket size={16} /> Deploy v{version + 1}
					</Button>
				{/if}
			</div>
		{/if}

		<Separator />
		<Button variant="destructive" size="sm" onclick={() => removeSelected()}>
			{isReplica ? 'Remover réplica' : 'Remover nó'}
		</Button>
	{:else if selectedEdge}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span class="rounded bg-muted px-1.5 py-0.5">Aresta</span>
			<span class="truncate font-mono">{selectedEdge.id}</span>
		</div>

		{#if showAmp}
			<div class="flex flex-col gap-1.5">
				<Label for="f-amp">Amplificação (chamadas por requisição)</Label>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						class="size-8 shrink-0"
						aria-label="Diminuir"
						disabled={edgeAmp <= 1}
						onclick={() => setAmp(edgeAmp - 1)}
					>
						<Minus size={16} />
					</Button>
					<Input
						id="f-amp"
						type="number"
						min="1"
						step="1"
						value={edgeAmp}
						class="flex-1 text-center"
						oninput={(e) => setAmp(num(e.currentTarget.value, 1))}
					/>
					<Button
						variant="outline"
						size="icon"
						class="size-8 shrink-0"
						aria-label="Aumentar"
						onclick={() => setAmp(edgeAmp + 1)}
					>
						<Plus size={16} />
					</Button>
				</div>
				<p class="text-xs text-muted-foreground">
					1 requisição a montante gera {edgeAmp}
					{edgeAmp === 1 ? 'chamada' : 'chamadas'} a jusante.
				</p>
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">
				Amplificação só se aplica a chamadas síncronas (serviço/monolito/pool → destino síncrono).
			</p>
		{/if}

		<Separator />
		<Button
			variant="destructive"
			size="sm"
			onclick={() => {
				graph.removeEdge(selectedEdge.id);
				ui.clear();
			}}
		>
			Remover aresta
		</Button>
	{:else}
		<p class="text-sm text-muted-foreground">Selecione um nó para editar suas propriedades.</p>
	{/if}
</aside>
