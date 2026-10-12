import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { originalWork } from "#engine/originalWork.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function ensurePublication({ board, save }: EngineState) {
	return Effect.fn("Fleet.ensurePublication")(function* (stored: Versioned<FleetRecord>) {
		const decision = stored.value.decision;
		if (decision === undefined || decision.published !== undefined) {
			return stored;
		}
		const work = decision.publicationWork ?? originalWork(stored.value);
		if (work === undefined) {
			return yield* Effect.fail(
				new Forbidden({ message: "Original Board context is unavailable; reconcile the decision publication receipt before renewal" }),
			);
		}
		const original = { ...decision, attentionOwner: decision.attentionOwner ?? ("maintainer" as const) };
		const published = yield* board.decision(stored.value.workId, original, work);
		if (published.workId !== work.workId || published.workRevision !== work.revision || published.request !== decision.id) {
			return yield* Effect.fail(
				new Forbidden({ message: "Decision publication does not match the original Board context; renewal retains its ownership" }),
			);
		}
		return yield* save(stored, { ...stored.value, decision: { ...original, published }, decisionPublished: true });
	});
}
