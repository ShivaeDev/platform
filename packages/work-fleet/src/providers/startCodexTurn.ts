import { Clock, Effect, Result } from "effect";
import { TurnResponse } from "#providers/codexProtocol.ts";
import { decode, failure } from "#providers/codexRpc.ts";
import type { CodexRequest, codexTurns } from "#providers/codexTurns.ts";

export function startCodexTurn(rpc: CodexRequest, waitUntilIdle: ReturnType<typeof codexTurns>["waitUntilIdle"]) {
	return Effect.fn("Codex.startCodexTurn")(function* (sessionId: string, params: Record<string, unknown>) {
		const deadline = (yield* Clock.currentTimeMillis) + 300_000;
		let resubmissions = 0;
		while (true) {
			const result = yield* rpc("turn/start", params, true).pipe(Effect.result);
			if (Result.isSuccess(result)) {
				return yield* decode(TurnResponse, result.success);
			}
			const error = result.failure;
			if (error.reason !== "rejected" || !/\bturn already active for thread\b/iu.test(error.message)) {
				return yield* error;
			}
			if (resubmissions >= 3) {
				return yield* failure("rejected", `${error.message}; active-turn resubmission limit reached`);
			}
			if (!(yield* waitUntilIdle(sessionId, deadline))) {
				return yield* failure("rejected", `${error.message}; active-turn wait deadline reached`);
			}
			resubmissions += 1;
		}
	});
}
