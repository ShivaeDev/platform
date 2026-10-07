import { Effect } from "effect";
import { failureMessage } from "#engine/failureMessage.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { assessPreparation } from "#preparation/compatibility.ts";
export function dispatchCommand({ board, load, save, decision, integrations }: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.dispatch")(function* (workId: string) {
		let stored = yield* load(workId);
		if (stored.value.stage !== "prepared") {
			return stored;
		}
		const work = yield* board.get(workId);
		if (work.revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed after preparation", "Approve the current Board revision and prepare this work again");
		}
		const assessment = yield* assessPreparation(stored.value.preparation, yield* integrations.main(stored.value.preparation));
		if (assessment._tag === "Reprepare") {
			return yield* decision(stored, assessment.reason, "Prepare the affected scope again before dispatch");
		}
		stored = yield* save(stored, { ...stored.value, preparation: assessment.preparation });
		return yield* launch(stored, "worker", stored.value.prompt).pipe(
			Effect.catch((error) =>
				Effect.gen(function* () {
					const current = yield* load(workId);
					yield* save(current, { ...current.value, blocker: failureMessage(error) });
					return yield* Effect.fail(error);
				}),
			),
		);
	});
}
