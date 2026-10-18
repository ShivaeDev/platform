import { Effect } from "effect";
import type { EngineState, LaunchAdmission } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { qualifyDependencies } from "#qualifyDependencies.ts";
import type { Versioned } from "#storage/model.ts";

function launched(record: FleetRecord, attempt: Attempt): FleetRecord {
	return {
		...record,
		admissionReady: true,
		attempts: [...record.attempts, attempt],
		blocker: undefined,
		launchRetry: undefined,
		mergeAreasReleased: undefined,
		mergeReadyAt: undefined,
		mergeReadyHead: undefined,
		pendingAnswers: undefined,
		stage: "executing",
	};
}

// Urgent work first asks for admission within the limits, so only a launch the limits refused is recorded as over the limit.
export const saveLaunch = Effect.fn("Fleet.saveLaunch")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	record: FleetRecord,
	attempt: Attempt,
	launch: Pick<LaunchAdmission, "quota" | "role"> & { readonly priority: BoardWork["priority"] },
) {
	const implementer = stored.value.stage === "prepared";
	const ignoreAreas = implementer && stored.value.dispatchNow?.ignoreAreas === true;
	const admission: LaunchAdmission = {
		areaWaiters: ignoreAreas || !stored.value.areas?.length ? [] : yield* areaWaiters(state, stored.value),
		ignoreAreas,
		implementer,
		quota: launch.quota,
		role: launch.role,
	};
	const urgent = implementer && (launch.priority === "urgent" || stored.value.dispatchNow !== undefined);
	return yield* state
		.save(stored, launched(record, attempt), admission)
		.pipe(
			Effect.catchTag("StorageCapacity", (error) =>
				urgent ? state.save(stored, launched(record, { ...attempt, overLimit: true }), { ...admission, overLimit: true }) : Effect.fail(error),
			),
		);
});

const areaWaiters = Effect.fn("Fleet.areaWaiters")(function* (state: EngineState, record: FleetRecord) {
	const records = (yield* state.store.list()).map(({ value }) => value);
	const waiting = records.filter(
		(entry) => entry.workId !== record.workId && entry.stage === "prepared" && entry.areas?.some((area) => record.areas?.includes(area)),
	);
	return yield* Effect.filter(waiting, (entry) =>
		state.board.get(entry.workId).pipe(
			Effect.flatMap((work) => qualifyDependencies(work.dependsOn, records, state.board.get).pipe(Effect.as(work.approved))),
			Effect.orElseSucceed(() => false),
		),
	).pipe(Effect.map((entries) => entries.map((entry) => entry.workId)));
});
