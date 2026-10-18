import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";

export const VISIBILITY_GRACE_MS = 5 * 60_000;

export const inspectThread = Effect.fn("Fleet.inspectThread")(function* (state: EngineState, attempt: Attempt) {
	if (attempt.receipt === undefined) {
		return yield* state.sessions.reconcile({ operationId: attempt.operationId, sessionId: attempt.sessionId }).pipe(
			Effect.as(undefined),
			Effect.catch((error) => Effect.succeed(error instanceof SessionFailure ? error.threadIdle : undefined)),
		);
	}
	return yield* state.sessions.observe(attempt.receipt).pipe(
		Effect.map((observation) => {
			if (observation.turnMissing !== true || observation.progress === undefined) {
				return undefined;
			}
			return observation.progress.length === 0;
		}),
		Effect.catch(() => Effect.succeed(undefined)),
	);
});
