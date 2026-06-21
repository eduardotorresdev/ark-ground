import type { BrandIcon } from '$lib/registry/icons';
import type { Preset } from '../types';

/** Top-level grouping shown as a section in the Exemplos tab. */
export type PresetCategory = 'monoliths' | 'microservices';

/** Human label for each category (Portuguese, shown as the section heading). */
export const CATEGORY_LABEL: Record<PresetCategory, string> = {
	monoliths: 'Monólitos',
	microservices: 'Microsserviços'
};

/**
 * A preset plus the UI-only metadata the serializable `Preset` does not carry:
 * its category and a brand icon (from `simple-icons`) for the card.
 */
export type PresetEntry = {
	preset: Preset;
	category: PresetCategory;
	icon: BrandIcon;
};
