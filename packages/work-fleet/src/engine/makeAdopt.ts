import { Effect } from "effect";
import { validateResult } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeAdopt({ integrations, save, decision }: EngineState) {
	return Effect.fn("Fleet.makeAdopt")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		if (stored.value.stage === "adopting") {
			if (work.revision !== stored.value.boardRevision) {
				return yield* decision(stored, "Board context changed while work ran", "Approve the current Board scope before adopting this result");
			}
			const latest = stored.value.attempts.at(-1);
			if (latest?.receipt === undefined) {
				return yield* Effect.fail(new FleetFailure({ message: "Terminal execution lacks receipt", reason: "invalid" }));
			}
			const result = yield* integrations.result(work, {
				execution: "completed",
				output: latest.output ?? "",
				provisioning: "unknown",
				receipt: latest.receipt,
			});
			yield* validateResult(stored.value, result);
			stored = yield* save(stored, { ...stored.value, checks: undefined, deliverySubmitted: false, result, review: undefined, stage: "reviewing" });
		}
		return stored;
	});
}
