import { Effect } from "effect";
import { validateChecks } from "#completion.ts";
import { exhaustedCheckRepairs } from "#engine/exhaustedCheckRepairs.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork, Checks } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeValidate(state: EngineState) {
	const { integrations, save } = state;
	return Effect.fn("Fleet.makeValidate")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (result === undefined) {
			return stored;
		}
		const head = result.head;
		if (stored.value.step === "validating") {
			const checks = yield* integrations.checks(work, result);
			stored = yield* save(stored, { ...stored.value, blocker: undefined, checks });
			if (checks.head === head && checks.pending && !checks.passed) {
				return stored;
			}
			if (checks.head === head && checks.evidence.length > 0 && !checks.passed && checks.repairPrompt?.trim()) {
				return yield* repairChecks(state, stored, checks);
			}
			yield* validateChecks(checks, head);
			stored = yield* save(stored, { ...stored.value, blocker: undefined, checks, step: "delivering" });
		}
		return stored;
	});
}

function repairChecks(state: EngineState, stored: Versioned<FleetRecord>, checks: Checks) {
	const exhausted = exhaustedCheckRepairs(stored.value, checks.failedChecks ?? []);
	return exhausted.length === 0
		? state.save(stored, { ...stored.value, areaQueuedAt: state.policy.now(), blocker: undefined, step: "repairing" })
		: state.decision(
				stored,
				"checks-repair-exhausted",
				`Required checks still fail after 3 consecutive check repairs: ${exhausted.join(", ")}`,
				"Inspect the failing checks and decide whether to retry or release the work",
			);
}
