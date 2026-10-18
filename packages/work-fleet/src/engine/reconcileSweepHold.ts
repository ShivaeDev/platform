import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import type { FleetRecord } from "#model.ts";
import { openSweep, sweepCycles, sweepMerged, touchesSweep } from "#scheduling/sweeps.ts";
import type { Versioned } from "#storage/model.ts";

export const reconcileSweepHold = Effect.fn("Fleet.reconcileSweepHold")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	const record = stored.value;
	const result = record.result;
	if (result?.kind !== "change") {
		return undefined;
	}
	const records = yield* state.store.list();
	const cycles = records.flatMap(({ value }) => sweepCycles(value));
	const hold = record.sweepHold;
	if (hold !== undefined) {
		const sweep = cycles.find((cycle) => cycle.workId === hold.workId && cycle.attempts.some((attempt) => attempt.operationId === hold.operationId));
		if (sweep !== undefined && sweepMerged(sweep)) {
			return yield* requestRework(state)(
				{ ...stored, value: { ...record, sweepHold: undefined } },
				[
					`Sweep ${hold.workId} merged. Fetch and merge main, then migrate this PR's changes onto what the sweep introduced.`,
					"Use the sweep's task brief as context:",
					hold.context,
				].join("\n\n"),
			);
		}
		if (sweep === undefined || openSweep(sweep)) {
			return yield* holdBehindSweep(state, stored, hold);
		}
	}
	const sweep = cycles.find((entry) => entry.workId !== record.workId && openSweep(entry) && touchesSweep(entry, result.paths));
	if (sweep !== undefined) {
		return yield* holdBehindSweep(state, stored, {
			context: sweep.boardContext ?? sweep.prompt,
			operationId: sweep.attempts[0]?.operationId ?? "",
			workId: sweep.workId,
		});
	}
	return hold === undefined
		? undefined
		: yield* state.save(stored, { ...record, attentionOwner: undefined, blocker: undefined, sweepHold: undefined });
});

function holdBehindSweep(state: EngineState, stored: Versioned<FleetRecord>, sweepHold: NonNullable<FleetRecord["sweepHold"]>) {
	const record = stored.value;
	const blocker = `Held behind sweep ${sweepHold.workId}`;
	if (
		record.sweepHold?.operationId === sweepHold.operationId
		&& record.sweepHold.workId === sweepHold.workId
		&& record.blocker === blocker
		&& record.decision === undefined
	) {
		return Effect.succeed(stored);
	}
	const published = record.decision?.published;
	return state
		.save(stored, {
			...record,
			attentionOwner: "automation",
			blocker,
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			stage: "delivering",
			supersededDecisions:
				published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
			sweepHold,
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
}
