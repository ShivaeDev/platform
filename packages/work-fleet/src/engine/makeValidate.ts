import { Effect } from "effect";
import { validateChecks } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeValidate({ integrations, save }: EngineState) {
	return Effect.fn("Fleet.makeValidate")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (result === undefined) {
			return stored;
		}
		const head = result.head;
		if (stored.value.stage === "validating") {
			const checks = yield* integrations.checks(work, result);
			stored = yield* save(stored, { ...stored.value, blocker: undefined, checks });
			if (checks.head === head && checks.evidence.length > 0 && !checks.passed && checks.repairPrompt?.trim()) {
				return yield* save(stored, { ...stored.value, blocker: undefined, stage: "repairing" });
			}
			yield* validateChecks(checks, head);
			stored = yield* save(stored, { ...stored.value, blocker: undefined, checks, stage: "delivering" });
		}
		return stored;
	});
}
