import { Effect } from "effect";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { allAttempts, executing } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export function continueCommand(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.continue")(function* (workId: string, message: string) {
		let stored = yield* state.load(workId);
		if (!message.trim()) {
			return yield* Effect.fail(new FleetFailure({ message: "Continuation needs a message", reason: "invalid" }));
		}
		if (!["needs-human", "completed"].includes(stored.value.stage) || executing(stored.value)) {
			return yield* Effect.fail(new FleetFailure({ message: "Continue requires terminal needs-human or completed work", reason: "denied" }));
		}
		if (stored.value.deliverySubmitted && stored.value.outcome === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Reconcile the submitted delivery before continuing", reason: "denied" }));
		}
		const latest = stored.value.attempts.findLast((attempt) => attempt.role !== "reviewer");
		const sessionId = latest?.receipt?.sessionId ?? latest?.sessionId;
		const worker = allAttempts(stored.value).findLast((attempt) => attempt.role !== "reviewer" && attempt.receipt?.sessionId === sessionId);
		if (worker?.receipt === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Continue requires an existing worker receipt", reason: "denied" }));
		}
		const observation = yield* state.sessions.observe(worker.receipt);
		if (["accepted", "running"].includes(observation.execution)) {
			return yield* Effect.fail(new FleetFailure({ message: "The existing worker turn is still running", reason: "denied" }));
		}
		stored = yield* ensurePublication(state)(stored);
		return yield* launch(stored, "repair", message);
	});
}
