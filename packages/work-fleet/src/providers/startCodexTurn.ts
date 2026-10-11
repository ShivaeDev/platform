import { Effect, Result } from "effect";
import { TurnResponse } from "#providers/codexProtocol.ts";
import { decode } from "#providers/codexRpc.ts";
import type { CodexRequest, codexTurns } from "#providers/codexTurns.ts";

export function startCodexTurn(rpc: CodexRequest, waitUntilIdle: ReturnType<typeof codexTurns>["waitUntilIdle"]) {
	return Effect.fn("Codex.startCodexTurn")(function* (sessionId: string, params: Record<string, unknown>) {
		while (true) {
			const result = yield* rpc("turn/start", params, true).pipe(Effect.result);
			if (Result.isSuccess(result)) {
				return yield* decode(TurnResponse, result.success);
			}
			const error = result.failure;
			if (error.reason !== "rejected" || !/\bturn already active for thread\b/iu.test(error.message)) {
				return yield* error;
			}
			yield* waitUntilIdle(sessionId);
		}
	});
}
