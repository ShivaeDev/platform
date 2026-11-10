import { Effect, Schema } from "effect";
import type { ReadFailure } from "@shivaedev/agent/failures.ts";
import type { Receipt, Reconciliation } from "@shivaedev/agent/run.ts";
import { AppServer } from "#adapters/server.ts";
import { Item, turns } from "#reads.ts";
import type { Session } from "#session.ts";
export function receiptOf(operationId: string, threadId: string, turnId: string): Receipt {
	return { backend: "codex", operationId, reference: { value: turnId, version: 1 }, session: { value: threadId, version: 1 } };
}
export const recovery = Effect.fn("Codex.recovery")(function* (sessions: Map<string, Session>) {
	const server = yield* AppServer;
	const operations = new Map<string, string | undefined>();
	const refusals = new Map<string, string>();
	const reconcile = Effect.fn("Codex.reconcile")(function* (operationId: string): Effect.fn.Return<Reconciliation, ReadFailure, AppServer> {
		const refusal = refusals.get(operationId);
		if (refusal !== undefined) {
			return { evidence: refusal, operationId, type: "not-accepted" };
		}
		const threadId = operations.get(operationId);
		if (threadId === undefined) {
			return { operationId, reason: "No local thread association; recover the session reference in the application", type: "uncertain" };
		}
		const matches = (yield* turns(threadId)).filter((turn) =>
			turn.items.some((item) => {
				const decoded = Schema.decodeUnknownOption(Item)(item);
				return decoded._tag === "Some" && decoded.value.type === "userMessage" && decoded.value.clientId === operationId;
			}),
		);
		const found = matches[0];
		if (matches.length !== 1 || found === undefined) {
			return {
				operationId,
				reason:
					matches.length > 1
						? "Multiple turns match this operation; preserve ownership"
						: "No matching turn is observable; absence does not authorize replay",
				type: "uncertain",
			};
		}
		yield* sessions.get(threadId)?.driver.recovered(found.id, found.status === "inProgress") ?? Effect.void;
		return { receipt: receiptOf(operationId, threadId, found.id), type: "accepted" };
	});
	return { operations, reconcile: (operationId: string) => reconcile(operationId).pipe(Effect.provideService(AppServer, server)), refusals };
});
