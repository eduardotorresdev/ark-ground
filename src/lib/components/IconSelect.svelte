<script lang="ts">
	import { Select } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import BrandIcon from './BrandIcon.svelte';
	import type { BrandIcon as BrandIconData } from '$lib/registry/icons';

	type Option = { id: string; label: string; icon: BrandIconData };

	let {
		value,
		options,
		placeholder = 'Selecionar…',
		onChange
	}: {
		value?: string;
		options: Option[];
		placeholder?: string;
		onChange: (id: string) => void;
	} = $props();

	const selected = $derived(options.find((o) => o.id === value));
</script>

<Select.Root type="single" {value} onValueChange={(v) => onChange(v)}>
	<Select.Trigger
		class="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-2 text-sm"
	>
		<span class="flex min-w-0 items-center gap-2">
			{#if selected}
				<BrandIcon icon={selected.icon} size={16} />
				<span class="truncate">{selected.label}</span>
			{:else}
				<span class="text-muted-foreground">{placeholder}</span>
			{/if}
		</span>
		<ChevronDown size={16} class="shrink-0 opacity-60" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-50 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			style="width: var(--bits-floating-anchor-width); min-width: 10rem;"
			sideOffset={4}
		>
			<Select.Viewport>
				{#each options as opt (opt.id)}
					<Select.Item
						value={opt.id}
						label={opt.label}
						class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted"
					>
						{#snippet children({ selected: isSelected })}
							<BrandIcon icon={opt.icon} size={16} />
							<span class="flex-1 truncate">{opt.label}</span>
							{#if isSelected}
								<Check size={14} class="shrink-0" />
							{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
