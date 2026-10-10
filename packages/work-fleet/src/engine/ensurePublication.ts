import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { originalWork } from "#engine/originalWork.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function ensurePublication({ board, save }: EngineState) {
	return Effect.fn("Fleet.ensurePublication")(function* (stored: Versioned<FleetRecord>) {
		const decision = stored.value.decision;
		if (decision === undefined || decision.published !== undefined) {
			return stored;
		}
		const work = originalWork(stored.value);
		if (work === undefined) {
			return yield* Effect.fail(
				new FleetFailure({
					message: "Original Board context is unavailable; reconcile the decision publication receipt before renewal",
					reason: "denied",
				}),
			);
		}
		const published = yield* board.decision(stored.value.workId, decision, work);
		if (published.workId !== work.workId || published.workRevision !== work.revision || published.request !== decision.id) {
			return yield* Effect.fail(
				new FleetFailure({
					message: "Decision publication does not match the original Board context; renewal retains its ownership",
					reason: "denied",
				}),
			);
		}
		return yield* save(stored, { ...stored.value, decision: { ...decision, published }, decisionPublished: true });
	});
}
