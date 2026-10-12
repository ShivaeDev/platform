import { Clock, Effect, Result } from "effect";
import { TurnResponse } from "#providers/codexProtocol.ts";
import { decode } from "#providers/codexRpc.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { SessionFailure } from "#session/schema.ts";
import { busyThread, transientFailure } from "#session/transientFailure.ts";

const turnRejection = Effect.fn("Codex.turnRejection")(function* (
	error: SessionFailure,
	sessionId: string,
	deadline: number,
	hasActiveTurn: ReturnType<typeof codexTurns>["hasActiveTurn"],
) {
	if (error.reason !== "rejected" || (error.code !== undefined && error.code !== "session-rejected")) {
		return error;
	}
	if (
		(transientFailure(error) && !busyThread(error))
		|| /credential|api key|unauthorized|unauthenticated|authentication|forbidden|policy|permission denied|access denied/iu.test(error.message)
	) {
		return error;
	}
	const remaining = deadline - (yield* Clock.currentTimeMillis);
	const active =
		remaining > 0
			? yield* hasActiveTurn(sessionId).pipe(
					Effect.timeout(`${remaining} millis`),
					Effect.catch(() => Effect.succeed(false)),
				)
			: false;
	return active ? new SessionFailure({ ...error, code: "session-active-turn", message: error.message }) : error;
});

export function startCodexTurn(rpc: CodexRequest, waitUntilIdle: ReturnType<typeof codexTurns>["waitUntilIdle"]) {
	const { hasActiveTurn } = codexTurns(rpc);
	return Effect.fn("Codex.startCodexTurn")(function* (sessionId: string, params: Record<string, unknown>) {
		const deadline = (yield* Clock.currentTimeMillis) + 300_000;
		let resubmissions = 0;
		while (true) {
			const result = yield* rpc("turn/start", params, true).pipe(Effect.result);
			if (Result.isSuccess(result)) {
				return yield* decode(TurnResponse, result.success);
			}
			const error = yield* turnRejection(result.failure, sessionId, deadline, hasActiveTurn);
			if (error.reason !== "rejected" || error.code !== "session-active-turn") {
				return yield* error;
			}
			if (resubmissions >= 3) {
				return yield* new SessionFailure({
					...error,
					code: "session-active-turn-exhausted",
					message: `${error.message}; active-turn resubmission limit reached`,
				});
			}
			if (!(yield* waitUntilIdle(sessionId, deadline))) {
				return yield* new SessionFailure({ ...error, message: `${error.message}; active-turn wait deadline reached` });
			}
			resubmissions += 1;
		}
	});
}
