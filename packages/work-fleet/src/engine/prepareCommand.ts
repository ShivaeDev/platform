import { Effect } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { briefChanged } from "#engine/boardBrief.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { inspectRenewal } from "#engine/inspectRenewal.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { PrepareWork } from "#fleet.ts";
import { executing, type FleetCycleSnapshot, type FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function prepareCommand(state: EngineState) {
	const { store, board, save } = state;
	return Effect.fn("Fleet.prepare")(function* (input: PrepareWork) {
		const work = yield* board.get(input.workId);
		if (!work.approved) {
			return yield* Effect.fail(
				withFailureContext(new Forbidden({ message: "Current Board revision needs maintainer approval" }), { code: "approval-required" }),
			);
		}
		if (!input.prompt.trim() || input.preparation.ownedPaths.length === 0) {
			return yield* Effect.fail(new BadRequest({ message: "Preparation needs fixed prompt and owned paths" }));
		}
		const current: FleetRecord = {
			areas: work.areas,
			attempts: [],
			boardContext: work.context,
			boardRevision: work.revision,
			boardSourcePath: work.sourcePath,
			cwd: input.cwd,
			...(work.deliverable === undefined ? {} : { deliverable: work.deliverable }),
			...(input.launch === undefined ? {} : { launch: input.launch }),
			preparation: input.preparation,
			prompt: input.prompt,
			stage: "prepared",
			workId: work.workId,
		};
		const existing = yield* store.load(work.workId);
		if (existing === undefined) {
			return yield* store.insert(current);
		}
		if (unusedPreparation(existing.value)) {
			return yield* save(existing, { ...current, history: existing.value.history });
		}
		return yield* renewPreparation(state, existing, current, work);
	});
}
function unusedPreparation(record: FleetRecord): boolean {
	return record.stage === "prepared" && record.attempts.length === 0 && record.decision === undefined && (record.responses?.length ?? 0) === 0;
}
const renewPreparation = Effect.fn("Fleet.renewPreparation")(function* (
	state: EngineState,
	input: Versioned<FleetRecord>,
	current: FleetRecord,
	work: BoardWork,
) {
	let existing = yield* ensurePublication(state)(input);
	yield* renewable(existing.value, work);
	existing = yield* inspectRenewal(state)(existing, work);
	if (existing.value.result?.kind === "change" && existing.value.outcome === undefined) {
		yield* state.store.reserveForeign(existing.value.result.pr, { backlog: true, executing: false });
	}
	return yield* state.save(existing, { ...current, history: [...(existing.value.history ?? []), snapshot(existing.value, state.policy.now())] });
});
const renewable = Effect.fn("Fleet.renewable")(function* (record: FleetRecord, work: BoardWork) {
	if (record.decision !== undefined && record.decision.published === undefined) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile the decision publication receipt before renewing preparation" }));
	}
	if (executing(record)) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile and confirm terminal execution before renewing preparation" }));
	}
	if (record.stage === "completed" && !briefChanged(record, work)) {
		return yield* Effect.fail(new Forbidden({ message: "Completed work needs a newly approved Board context before renewal" }));
	}
});
function snapshot(record: FleetRecord, archivedAt: number): FleetCycleSnapshot {
	const { workId: _workId, history: _history, ...cycle } = record;
	return { ...cycle, archivedAt };
}
