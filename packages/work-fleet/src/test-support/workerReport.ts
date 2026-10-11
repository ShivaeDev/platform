import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
import { type EngineFixture, prepareWork } from "#test/engine.ts";

export const workerReportReply = Effect.fn("Test.workerReportReply")(function* (
	fixture: EngineFixture,
	stored: Versioned<FleetRecord>,
	output: string,
) {
	const receipt = stored.value.attempts.at(-1)?.receipt;
	if (receipt === undefined) {
		return yield* Effect.die(new Error("Worker receipt missing"));
	}
	fixture.observations.set(receipt.turnId, { execution: "completed", output, provisioning: "ready", receipt });
	return receipt;
});

export const startWorkerReport = Effect.fn("Test.startWorkerReport")(function* (fixture: EngineFixture, output: string) {
	const fleet = yield* Fleet;
	yield* prepareWork("one");
	const dispatched = yield* fleet.dispatch("one");
	const original = yield* workerReportReply(fixture, dispatched, output);
	return { followUp: yield* fleet.reconcile("one"), original };
});
