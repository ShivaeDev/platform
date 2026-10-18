import { Effect } from "effect";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { Fleet } from "#fleet.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";
import { askWorker } from "#test/workerQuestion.ts";

export const prepareBookkeepingPhase = Effect.fn("Fleet.prepareBookkeepingPhase")(function* (
	fixture: EngineFixture<unknown>,
	phase: string,
	wholeFileRevision = false,
) {
	const fleet = yield* Fleet;
	yield* prepareWork("one");
	if (wholeFileRevision) {
		const prepared = (yield* fleet.get("one")).value;
		const context = prepared.boardContext ?? (yield* Effect.die("Missing saved Board source"));
		yield* fixture.replaceRecord({ ...prepared, boardRevision: revisionOf(context) });
	}
	if (phase !== "preparation") {
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
	}
	if (["review", "completed"].includes(phase)) {
		finishWorkers(fixture);
		yield* fleet.reconcile("one");
	} else if (phase === "decision") {
		yield* askWorker(fixture);
	}
	return yield* fleet.get("one");
});
