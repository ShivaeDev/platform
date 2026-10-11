import { Effect, Result } from "effect";
import { authorizeBrief, refreshBrief } from "#engine/boardBrief.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { FleetFailure } from "#policy.ts";
import { assessPreparation } from "#preparation/compatibility.ts";
export function dispatchCommand(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	const { board, load, save, decision, integrations, policy } = state;
	return Effect.fn("Fleet.dispatch")(function* (workId: string) {
		let stored = yield* load(workId);
		if (stored.value.stage !== "prepared") {
			return stored;
		}
		if (stored.value.launchRetry !== undefined && policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const work = yield* board.get(workId);
		const authorized = yield* authorizeBrief(work).pipe(Effect.result);
		if (Result.isFailure(authorized)) {
			return yield* decision(
				stored,
				authorized.failure.message,
				"Restore approval for work that is still needed, or release it",
				undefined,
				"maintainer",
			);
		}
		stored = yield* refreshBrief(state)(stored, work);
		const assessment = yield* assessPreparation(stored.value.preparation, yield* integrations.main(stored.value.preparation));
		if (assessment._tag === "Reprepare") {
			return yield* decision(stored, assessment.reason, "Prepare the affected scope again before dispatch");
		}
		stored = yield* save(stored, { ...stored.value, preparation: assessment.preparation });
		return yield* launch(stored, "worker", stored.value.prompt).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(workId);
					if (current.value.stage !== "prepared") {
						return current;
					}
					yield* save(current, {
						...current.value,
						admissionReady: !(error instanceof FleetFailure && error.reason === "denied"),
						attentionOwner: failureOwner(error),
						blocker: failureMessage(error),
					});
					return yield* Effect.fail(error);
				}),
			),
		);
	});
}
