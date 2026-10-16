import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { SessionObservation } from "#session/schema.ts";

export function stalledProgress(observation: SessionObservation): SessionObservation {
	return { ...observation, progress: [{ id: "unchanged" }] };
}

export const parkStalled = Effect.fnUntraced(function* (advance: () => void) {
	const fleet = yield* Fleet;
	yield* fleet.reconcile("one");
	for (let step = 0; step < 3; step += 1) {
		advance();
		yield* fleet.reconcile("one");
	}
	return yield* fleet.get("one");
});
