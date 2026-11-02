import { Effect } from "effect";
import { holdCiChanges } from "#engine/ciHold.ts";
import { makeDeliver } from "#engine/makeDeliver.ts";
import { EngineContext } from "#engine/makeState.ts";
import { repairParkedChecks } from "#engine/repairParkedChecks.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const reconcileQueuedDelivery = Effect.fn("Fleet.reconcileQueuedDelivery")(function* (input: Versioned<FleetRecord>) {
	const state = yield* EngineContext;
	const held = yield* holdCiChanges(input);
	if (held !== undefined) {
		return { held: true, stored: held };
	}
	const stored = yield* repairParkedChecks(input);
	return { held: false, stored: stored.value.mergeQueue?.status === "queued" ? yield* makeDeliver(state)(stored) : stored };
});
