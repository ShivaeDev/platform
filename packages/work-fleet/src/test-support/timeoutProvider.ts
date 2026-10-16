import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";
import { type ContinueSession, SessionFailure, type SessionReceipt } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

export const TIMEOUT = "Codex request timed out; preserve submission ownership";

export function timeoutProvider(landed: boolean, priorTurn: boolean) {
	const inputs: ContinueSession[] = [];
	const state = { inputs, reads: 0, submissions: 0 };
	function decorateTransport(transport: typeof SessionTransport.Service): typeof SessionTransport.Service {
		let accepted: SessionReceipt | undefined;
		const startTurn: typeof transport.startTurn = (input) =>
			Effect.gen(function* () {
				state.inputs.push(input);
				state.submissions += 1;
				if (landed || state.submissions > 2) {
					accepted = yield* transport.startTurn(input);
				}
				return state.submissions <= (landed ? 1 : 2)
					? yield* new SessionFailure({ message: TIMEOUT, reason: "ambiguous" })
					: (accepted ?? (yield* Effect.die("Missing receipt")));
			});
		const rpc: CodexRequest = (method, params) =>
			Effect.gen(function* () {
				const input = state.inputs[0];
				if (input === undefined) {
					return yield* Effect.die("Missing saved operation");
				}
				if (method === "turn/start") {
					expect(params).toMatchObject({ clientUserMessageId: input.operationId, input: [{ text: input.prompt }], threadId: input.sessionId });
					const receipt = yield* startTurn(input);
					return { turn: { id: receipt.turnId } };
				}
				expect(method).toBe("thread/turns/list");
				state.reads += 1;
				return turnPage(priorTurn, accepted, input.operationId);
			});
		const adapter = codexAdapter(rpc, { beforeTurn: () => Effect.succeed({}), provisioning: "unknown", recoveryGraceMs: 0, threadStart: () => ({}) });
		return { ...transport, reconcile: adapter.reconcile, startTurn };
	}
	return { decorateTransport, state };
}

function turnPage(priorTurn: boolean, accepted: SessionReceipt | undefined, operationId: string) {
	const existing = priorTurn ? [{ id: "prior-turn", items: [], status: "completed" }] : [];
	const matching =
		accepted === undefined
			? []
			: [
					{
						id: accepted.turnId,
						items: [{ clientId: operationId, id: "input", type: "userMessage" }],
						status: "inProgress",
					},
				];
	return { data: [...existing, ...matching], nextCursor: null };
}
