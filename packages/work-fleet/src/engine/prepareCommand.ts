import { Effect } from "effect";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { inspectRenewal } from "#engine/inspectRenewal.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { PrepareWork } from "#fleet.ts";
import { executing, type FleetCycleSnapshot, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export function prepareCommand(state: EngineState) {
	const { store, board, policy, save } = state;
	return Effect.fn("Fleet.prepare")(function* (input: PrepareWork) {
		const work = yield* board.get(input.workId);
		if (policy.approved[work.workId] !== work.revision) {
			return yield* Effect.fail(new FleetFailure({ message: "Current Board revision needs maintainer approval", reason: "denied" }));
		}
		if (!input.prompt.trim() || input.preparation.ownedPaths.length === 0) {
			return yield* Effect.fail(new FleetFailure({ message: "Preparation needs fixed prompt and owned paths", reason: "invalid" }));
		}
		const current: FleetRecord = {
			attempts: [],
			boardContext: work.context,
			boardRevision: work.revision,
			boardSourcePath: work.sourcePath,
			cwd: input.cwd,
			preparation: input.preparation,
			prompt: input.prompt,
			stage: "prepared",
			workId: work.workId,
		};
		let existing = yield* store.load(work.workId);
		if (existing === undefined) {
			return yield* store.insert(current);
		}
		existing = yield* ensurePublication(state)(existing);
		yield* renewable(existing.value, work.revision);
		existing = yield* inspectRenewal(state)(existing, work);
		if (existing.value.result?.kind === "change" && existing.value.outcome === undefined) {
			yield* store.reserveForeign(existing.value.result.pr, existing.value.result.paths, { backlog: true, executing: false, preservePaths: true });
		}
		return yield* save(existing, { ...current, history: [...(existing.value.history ?? []), snapshot(existing.value, policy.now())] });
	});
}
const renewable = Effect.fn("Fleet.renewable")(function* (record: FleetRecord, revision: string) {
	if (record.decision !== undefined && record.decision.published === undefined) {
		return yield* Effect.fail(
			new FleetFailure({ message: "Reconcile the decision publication receipt before renewing preparation", reason: "denied" }),
		);
	}
	if (executing(record)) {
		return yield* Effect.fail(
			new FleetFailure({ message: "Reconcile and confirm terminal execution before renewing preparation", reason: "denied" }),
		);
	}
	if (record.deliverySubmitted && record.outcome === undefined) {
		return yield* Effect.fail(new FleetFailure({ message: "Reconcile the submitted delivery before renewing preparation", reason: "denied" }));
	}
	if (record.stage === "completed" && record.boardRevision === revision) {
		return yield* Effect.fail(new FleetFailure({ message: "Completed work needs a newly approved Board context before renewal", reason: "denied" }));
	}
});
function snapshot(record: FleetRecord, archivedAt: number): FleetCycleSnapshot {
	const { workId: _workId, history: _history, ...cycle } = record;
	return { ...cycle, archivedAt };
}
