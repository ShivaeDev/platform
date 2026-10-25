import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
import type { EngineFixture } from "#test/engine.ts";

export const workerReportReply = Effect.fn("Test.workerReportReply")(function* (
	fixture: EngineFixture,
	stored: Versioned<FleetRecord>,
	output: string,
) {
	const receipt = stored.value.attempts.at(-1)?.receipt;
	if (receipt === undefined || !fixture.observations.has(receipt.turnId)) {
		return yield* Effect.die(new Error("Worker receipt missing"));
	}
	fixture.observations.set(receipt.turnId, { execution: "completed", output, provisioning: "ready", receipt });
	return receipt;
});
