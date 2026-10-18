import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt } from "#model.ts";

export function releaseReceipts(state: EngineState, attempt: Attempt) {
	if (attempt.terminalReceipts !== undefined && attempt.terminalReceipts.length > 0) {
		const receipts = [...attempt.terminalReceipts, ...(attempt.receipt === undefined ? [] : [attempt.receipt])];
		return Effect.succeed([...new Map(receipts.map((receipt) => [JSON.stringify([receipt.sessionId, receipt.turnId]), receipt])).values()]);
	}
	if (attempt.receipt !== undefined) {
		return Effect.succeed([attempt.receipt]);
	}
	return state.sessions.reconcile({ operationId: attempt.operationId, sessionId: attempt.sessionId }).pipe(
		Effect.map((receipt) => [receipt]),
		Effect.catch((error) => {
			if (error.terminalReceipts !== undefined && error.terminalReceipts.length > 0) {
				return Effect.succeed(error.terminalReceipts);
			}
			return error.code === "session-turn-missing" && error.reason === "ambiguous" && error.threadIdle === true
				? Effect.succeed([])
				: Effect.fail(new ServiceUnavailable({ message: error.message }));
		}),
	);
}
