import type { SessionTransport } from "#session/service.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";

export function lostTurnProvider() {
	const missing = missingTurnTransport();
	const lost = new Set<string>();
	return {
		decorate: (transport: typeof SessionTransport.Service): typeof SessionTransport.Service => {
			const invisible = missing.decorate(transport);
			return {
				...transport,
				observe: (receipt) => (lost.has(receipt.sessionId) ? invisible.observe(receipt) : transport.observe(receipt)),
				reconcile: (input) => (input.sessionId !== undefined && lost.has(input.sessionId) ? invisible.reconcile(input) : transport.reconcile(input)),
			};
		},
		lose: (sessionId: string | undefined) => {
			if (sessionId === undefined) {
				throw new Error("Cannot lose an unacknowledged session");
			}
			lost.add(sessionId);
		},
	};
}
