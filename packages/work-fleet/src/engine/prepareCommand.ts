import { Effect } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { inspectRenewal } from "#engine/inspectRenewal.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { PrepareWork } from "#fleet.ts";
import { executing, type FleetCycleSnapshot, type FleetRecord } from "#model.ts";

export function prepareCommand(state: EngineState) {
	const { store, board, policy, save } = state;
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
		let existing = yield* store.load(work.workId);
		if (existing === undefined) {
			return yield* store.insert(current);
		}
		existing = yield* ensurePublication(state)(existing);
		yield* renewable(existing.value, work.revision);
		existing = yield* inspectRenewal(state)(existing, work);
		if (existing.value.result?.kind === "change" && existing.value.outcome === undefined) {
			yield* store.reserveForeign(existing.value.result.pr, { backlog: true, executing: false });
		}
		return yield* save(existing, { ...current, history: [...(existing.value.history ?? []), snapshot(existing.value, policy.now())] });
	});
}
const renewable = Effect.fn("Fleet.renewable")(function* (record: FleetRecord, revision: string) {
	if (record.decision !== undefined && record.decision.published === undefined) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile the decision publication receipt before renewing preparation" }));
	}
	if (executing(record)) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile and confirm terminal execution before renewing preparation" }));
	}
	if (record.stage === "completed" && record.boardRevision === revision) {
		return yield* Effect.fail(new Forbidden({ message: "Completed work needs a newly approved Board context before renewal" }));
	}
});
function snapshot(record: FleetRecord, archivedAt: number): FleetCycleSnapshot {
	const { workId: _workId, history: _history, ...cycle } = record;
	return { ...cycle, archivedAt };
}
