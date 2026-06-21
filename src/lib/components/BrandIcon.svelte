<script lang="ts">
	import type { BrandIcon } from '$lib/registry/icons';

	let {
		icon,
		size = 16,
		/** override the brand color; defaults to the icon's own brand hex */
		color
	}: { icon: BrandIcon; size?: number; color?: string } = $props();
</script>

<svg
	role="img"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill={color ?? `#${icon.hex}`}
	xmlns="http://www.w3.org/2000/svg"
	aria-label={icon.title}
>
	<title>{icon.title}</title>
	<path d={icon.path} />
</svg>
