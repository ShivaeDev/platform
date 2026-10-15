import { Clock, Effect, Result } from "effect";
import { TurnResponse } from "#providers/codexProtocol.ts";
import { decode } from "#providers/codexRpc.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { genericRejection } from "#providers/genericRejection.ts";
import { SessionFailure } from "#session/schema.ts";
import { busyThread, transientFailure } from "#session/transientFailure.ts";

const contentionState = Effect.fn("Codex.contentionState")(function* (
	error: SessionFailure,
	sessionId: string,
	deadline: number,
	hasActiveTurn: ReturnType<typeof codexTurns>["hasActiveTurn"],
) {
	if (error.reason !== "rejected" || (error.code !== undefined && error.code !== "session-rejected")) {
		return undefined;
	}
	if (
		genericRejection(error)
		|| (transientFailure(error) && !busyThread(error))
		|| /credential|api key|unauthorized|unauthenticated|authentication|forbidden|policy|permission|access denied|invalid|quota/iu.test(error.message)
	) {
		return undefined;
	}
	const remaining = deadline - (yield* Clock.currentTimeMillis);
	const active =
		remaining > 0
			? yield* hasActiveTurn(sessionId).pipe(
					Effect.timeout(`${remaining} millis`),
					Effect.catch(() => Effect.succeed(undefined)),
				)
			: undefined;
	return active === false && !busyThread(error) ? undefined : active;
});

const waitForResubmission = Effect.fn("Codex.waitForResubmission")(function* (
	sessionId: string,
	deadline: number,
	resubmissions: number,
	active: boolean,
	waitUntilIdle: ReturnType<typeof codexTurns>["waitUntilIdle"],
) {
	if (!active) {
		const remaining = deadline - (yield* Clock.currentTimeMillis);
		yield* Effect.sleep(Math.min(5000 * 2 ** resubmissions, 40_000, Math.max(0, remaining)));
	}
	return yield* waitUntilIdle(sessionId, deadline);
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
			const active = yield* contentionState(result.failure, sessionId, deadline, hasActiveTurn);
			if (active === undefined) {
				return yield* result.failure;
			}
			const error = new SessionFailure({ ...result.failure, code: "session-active-turn", message: result.failure.message });
			if (resubmissions >= 3) {
				return yield* new SessionFailure({
					...error,
					code: "session-active-turn-exhausted",
					message: `${error.message}; active-turn resubmission limit reached`,
				});
			}
			if (!(yield* waitForResubmission(sessionId, deadline, resubmissions, active, waitUntilIdle))) {
				return yield* new SessionFailure({ ...error, message: `${error.message}; active-turn wait deadline reached` });
			}
			resubmissions += 1;
		}
	});
}
