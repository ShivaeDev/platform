import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork, Delivery } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeDeliver({ integrations, save, decision }: EngineState) {
	return Effect.fn("Fleet.makeDeliver")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (stored.value.stage !== "delivering" || result === undefined) {
			return stored;
		}
		if (result.kind === "no-change") {
			return yield* save(stored, { ...stored.value, blocker: undefined, outcome: { evidence: result.evidence }, stage: "completed" });
		}
		if (!(yield* integrations.authorize(work, result))) {
			return yield* decision(stored, "Runtime policy denies delivery", "Approve delivery scope in trusted runtime policy");
		}
		const head = result.head;
		const accepted = yield* integrations.delivery(result);
		function accept(delivery: Delivery) {
			return delivery.head === head
				? save(stored, { ...stored.value, blocker: undefined, outcome: delivery, stage: "completed" })
				: decision(stored, "Delivered revision differs from reviewed head", "Inspect actual delivery before accepting this work");
		}
		if (accepted !== undefined) {
			return yield* accept(accepted);
		}
		if (stored.value.deliverySubmitted) {
			return yield* decision(stored, "Delivery acknowledgement is unresolved", "Reconcile the existing PR; do not submit a duplicate merge");
		}
		stored = yield* save(stored, { ...stored.value, blocker: undefined, deliverySubmitted: true });
		const delivered = yield* integrations.merge(work, result);
		return yield* accept(delivered);
	});
}
