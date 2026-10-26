import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { SessionTransport } from "#session/service.ts";

export function lostTurnProvider() {
	const lost = new Set<string>();
	const active = new Set<string>();
	const invisible = codexAdapter(
		(method, params) =>
			Effect.sync(() => {
				if (method === "thread/items/list") {
					return { data: [], nextCursor: null };
				}
				if (method !== "thread/turns/list" || typeof params !== "object" || params === null || !("threadId" in params)) {
					throw new Error(`Unexpected lost-turn request: ${method}`);
				}
				return {
					data: [{ id: "unrelated-turn", items: [], status: active.has(String(params.threadId)) ? "inProgress" : "completed" }],
					nextCursor: null,
				};
			}),
		{ beforeTurn: () => Effect.succeed({}), provisioning: "unknown", threadStart: () => ({}) },
	);
	return {
		active: (sessionId: string) => active.add(sessionId),
		decorate: (transport: typeof SessionTransport.Service): typeof SessionTransport.Service => ({
			...transport,
			observe: (receipt) => (lost.has(receipt.sessionId) ? invisible.observe(receipt) : transport.observe(receipt)),
			reconcile: (input) => (input.sessionId !== undefined && lost.has(input.sessionId) ? invisible.reconcile(input) : transport.reconcile(input)),
		}),
		idle: (sessionId: string) => active.delete(sessionId),
		lose: (sessionId: string | undefined) => {
			if (sessionId === undefined) {
				throw new Error("Cannot lose an unacknowledged session");
			}
			lost.add(sessionId);
		},
		restore: (sessionId: string) => lost.delete(sessionId),
	};
}
