import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { missingBoardItem } from "#engine/missingBoardWork.ts";
import type { FleetRecord } from "#model.ts";
import type { Priority } from "#policy.ts";
import { qualifyDependencies } from "#qualifyDependencies.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS, holdsAreas, overlappingArea } from "#scheduling/areas.ts";
import { priorityRanks } from "#scheduling/priorityRanks.ts";

export const areaWaiters = Effect.fn("Fleet.areaWaiters")(function* (state: EngineState, record: FleetRecord, priority: Priority = "normal") {
	const policy = yield* state.current;
	if (!record.areas?.length || holdsAreas(record, policy.now(), policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS)) {
		return [];
	}
	const records = (yield* state.store.list()).map(({ value }) => value);
	const index = records.findIndex((entry) => entry.workId === record.workId);
	const waiting = records.filter(
		(entry) => entry.workId !== record.workId && entry.step === "queued" && overlappingArea(record.areas ?? [], entry.areas) !== undefined,
	);
	return yield* Effect.filter(waiting, (entry) =>
		state.board.get(entry.workId).pipe(
			Effect.flatMap((work) =>
				priorityRanks[work.priority ?? "normal"] > priorityRanks[priority]
				|| (priorityRanks[work.priority ?? "normal"] === priorityRanks[priority] && records.indexOf(entry) >= index)
					? Effect.succeed(false)
					: qualifyDependencies(work.dependsOn, records, state.board.get).pipe(
							Effect.as(work.approved),
							Effect.catchTag("Forbidden", () => Effect.succeed(false)),
						),
			),
			Effect.catchTag("BoardFailure", (error) =>
				missingBoardItem(error) || records.indexOf(entry) >= index ? Effect.succeed(false) : Effect.fail(error),
			),
		),
	).pipe(Effect.map((entries) => entries.map((entry) => entry.workId)));
});
