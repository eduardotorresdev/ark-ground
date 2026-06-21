<script lang="ts">
	import { Tabs } from 'bits-ui';
	import Palette from './Palette.svelte';
	import Examples from './Examples.svelte';

	let tab = $state('componentes');

	const trigger =
		'flex-1 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';
</script>

<aside class="flex h-full w-full flex-col border-r bg-sidebar">
	<Tabs.Root bind:value={tab} class="flex min-h-0 flex-1 flex-col">
		<Tabs.List class="m-3 mb-0 flex shrink-0 gap-1 rounded-lg bg-muted p-1">
			<Tabs.Trigger value="componentes" class={trigger}>Componentes</Tabs.Trigger>
			<Tabs.Trigger value="exemplos" class={trigger}>Exemplos</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="componentes" class="min-h-0 flex-1 overflow-y-auto p-3">
			<Palette />
		</Tabs.Content>
		<Tabs.Content value="exemplos" class="min-h-0 flex-1 overflow-y-auto p-3">
			<Examples />
		</Tabs.Content>
	</Tabs.Root>
</aside>
