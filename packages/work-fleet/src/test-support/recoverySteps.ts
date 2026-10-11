import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { SessionObservation } from "#session/schema.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";
import type { RecoveryContext } from "#test/recoveryCase.ts";

export const launchRecoveryWorker = Effect.fn("Test.launchRecoveryWorker")(function* () {
	yield* prepareWork("one");
	yield* (yield* Fleet).dispatch("one");
});
export const finishRecoveryWorker = Effect.fn("Test.finishRecoveryWorker")(function* (context: RecoveryContext, output = REPORT) {
	yield* launchRecoveryWorker();
	setLastObservation(context, { execution: "completed", output });
	yield* (yield* Fleet).reconcile("one");
});
export function setLastObservation({ fixture }: RecoveryContext, update: Partial<SessionObservation>) {
	const last = [...fixture.observations.entries()].at(-1);
	if (last === undefined) {
		throw new Error("Missing synthetic provider observation");
	}
	fixture.observations.set(last[0], { ...last[1], ...update });
}
export const finishRecoveryReview = Effect.fn("Test.finishRecoveryReview")(function* (context: RecoveryContext) {
	yield* finishRecoveryWorker(context);
	finishWorkers(context.fixture);
	yield* (yield* Fleet).reconcile("one");
});
export function changeRecoveryWork({ root, source }: RecoveryContext) {
	writeFileSync(join(root, "one.md"), `${source}\nChanged approved scope.\n`);
}
