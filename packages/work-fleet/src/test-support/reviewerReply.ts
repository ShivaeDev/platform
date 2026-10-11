import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
import type { EngineFixture } from "#test/engine.ts";

export const reviewerReply = Effect.fn("Test.reviewerReply")(function* (fixture: EngineFixture, stored: Versioned<FleetRecord>, output: string) {
	const receipt = stored.value.attempts.at(-1)?.receipt;
	if (receipt === undefined) {
		return yield* Effect.die(new Error("Reviewer receipt missing"));
	}
	fixture.observations.set(receipt.turnId, { execution: "completed", output, provisioning: "ready", receipt });
	return receipt;
});
