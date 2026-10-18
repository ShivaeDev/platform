import { Effect } from "effect";
import type { EngineState, LaunchAdmission } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { qualifyDependencies } from "#qualifyDependencies.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS, holdsAreas } from "#scheduling/areas.ts";
import type { Versioned } from "#storage/model.ts";

function launched(record: FleetRecord, attempt: Attempt): FleetRecord {
	return {
		...record,
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
	const policy = yield* state.current;
	if (holdsAreas(record, policy.now(), policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS)) {
		return [];
	}
	const records = (yield* state.store.list()).map(({ value }) => value);
	const index = records.findIndex((entry) => entry.workId === record.workId);
	const waiting = records.slice(0, index).filter((entry) => entry.stage === "prepared" && entry.areas?.some((area) => record.areas?.includes(area)));
	return yield* Effect.filter(waiting, (entry) =>
		state.board.get(entry.workId).pipe(
			Effect.flatMap((work) =>
				qualifyDependencies(work.dependsOn, records, state.board.get).pipe(
					Effect.as(work.approved),
					Effect.catchTag("Forbidden", () => Effect.succeed(false)),
				),
			),
		),
	).pipe(Effect.map((entries) => entries.map((entry) => entry.workId)));
});
