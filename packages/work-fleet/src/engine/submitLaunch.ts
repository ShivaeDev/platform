import { Effect, Fiber } from "effect";
import { capacityRetry } from "#engine/capacityRetry.ts";
import type { EngineState } from "#engine/makeState.ts";
import { retryAnsweredQuestion } from "#engine/retryAnsweredQuestion.ts";
import { submissionFailure } from "#engine/submissionFailure.ts";
import type { FleetRecord } from "#model.ts";
import type { SessionFailure, SessionReceipt } from "#session/schema.ts";

const handleFailure = Effect.fn("Fleet.handleFailure")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	error: SessionFailure,
) {
	if (yield* capacityRetry(state, previous, operationId, error)) {
		return;
	}
	if (yield* retryAnsweredQuestion(state, previous, operationId, error)) {
		return;
	}
	yield* submissionFailure(state, previous.workId, operationId, error, "Restore provider access and retry this approved work");
});

export const submitLaunch = Effect.fn("Fleet.submitLaunch")(function* (
	state: EngineState,
	previous: FleetRecord,
	operationId: string,
	submitted: Effect.Effect<SessionReceipt, SessionFailure>,
) {
	yield* Effect.uninterruptibleMask((restore) =>
		Effect.gen(function* () {
			state.launching.add(operationId);
			const submission = yield* restore(
				submitted.pipe(
					Effect.catch((error) => handleFailure(state, previous, operationId, error)),
					Effect.ensuring(Effect.sync(() => state.launching.delete(operationId))),
				),
			).pipe(Effect.forkIn(state.launchScope));
			yield* restore(
				Fiber.join(submission).pipe(
					Effect.timeout("1 second"),
					Effect.catchTag("TimeoutError", () => Effect.void),
				),
			).pipe(Effect.onInterrupt(() => Fiber.interrupt(submission)));
		}),
	);
});
