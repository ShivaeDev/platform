import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { ReconcileSession } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export function missingTurnTransport() {
	const requests: string[] = [];
	const recoveries: ReconcileSession[] = [];
	const provider = codexAdapter(
		(method) =>
			Effect.sync(() => {
				requests.push(method);
				if (method !== "thread/turns/list") {
					throw new Error(`Unexpected missing-turn request: ${method}`);
				}
				return { data: [], nextCursor: null };
			}),
		{ beforeTurn: () => Effect.succeed({}), provisioning: "unknown", threadStart: () => ({}) },
	);
	return {
		decorate: (transport: typeof SessionTransport.Service): typeof SessionTransport.Service => ({
			...transport,
			observe: (receipt) => provider.reconcile({ ...receipt, operationId: "legacy-observation" }).pipe(Effect.flatMap(provider.observe)),
			reconcile: (input) => {
				recoveries.push(input);
				return provider.reconcile(input);
			},
		}),
		recoveries,
		requests,
	};
}
