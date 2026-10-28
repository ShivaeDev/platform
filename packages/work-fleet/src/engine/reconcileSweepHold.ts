import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { executing, type FleetRecord } from "#model.ts";
import { openSweep, sweepCycles, sweepMerged, touchesSweep } from "#scheduling/sweeps.ts";
import { StorageAdmission } from "#storage/errors.ts";
import type { Versioned } from "#storage/model.ts";

export function holdPendingReady(state: EngineState, stored: Versioned<FleetRecord>) {
	return stored.value.decision?.code === "reviewed-pr-ready" && stored.value.decision.published === undefined
		? reconcileSweepHold(state, stored).pipe(Effect.map((held) => held ?? stored))
		: Effect.succeed(stored);
}

export const holdRejectedReadiness = Effect.fn("Fleet.holdRejectedReadiness")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	error: unknown,
) {
	if (!(error instanceof StorageAdmission) || error.sweepHold === undefined) {
		return undefined;
	}
	return stored.value.result?.head === error.head ? yield* holdBehindSweep(state, stored, error.sweepHold) : stored;
});

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

export function holdBehindSweep(state: EngineState, stored: Versioned<FleetRecord>, sweepHold: NonNullable<FleetRecord["sweepHold"]>) {
	const record = stored.value;
	if (
		!["delivering", "waiting"].includes(record.step)
		|| executing(record)
		|| record.result?.kind !== "change"
		|| (record.decision?.code !== undefined && record.decision.code !== "reviewed-pr-ready")
	) {
		return Effect.succeed(stored);
	}
	const blocker = `Held behind sweep ${sweepHold.workId}`;
	if (
		record.sweepHold?.operationId === sweepHold.operationId
		&& record.sweepHold.workId === sweepHold.workId
		&& record.blocker === blocker
		&& record.decision === undefined
		&& record.mergeAreasReleased === true
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
			mergeAreasReleased: true,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			step: "delivering",
			supersededDecisions:
				published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
			sweepHold,
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
}
