import Inbox from '@lucide/svelte/icons/inbox';
import type { NodeDef } from '../types';

/**
 * Message broker / queue: the asynchronous node. Producers publish into a buffer
 * and consumers drain it at their own pace, so a slow consumer builds backlog
 * instead of back-pressuring the producer. Because async communication decouples
 * lifecycles, the broker is a *quantum boundary* (see `sim/quanta.ts`).
 */
export const brokerDef: NodeDef<'broker'> = {
	kind: 'broker',
	label: 'Mensageria',
	category: 'Simulação',
	icon: Inbox,
	accent: 'border-teal-300 bg-teal-50 text-teal-700',
	ports: [
		{ id: 'in', dir: 'in', accepts: ['load', 'service', 'monolith'] },
		{ id: 'out', dir: 'out', accepts: ['service', 'monolith', 'load-balancer'] }
	],
	create: () => ({
		label: 'Mensageria',
		mode: 'work-queue',
		bufferSize: 10000,
		maxDeliveryRate: 10000,
		fullPolicy: 'drop'
	})
};
