import { Effect } from "effect";
import { workMetadata } from "#board/readPass.ts";
import { approveBrief } from "#engine/approveBrief.ts";
import { briefChanged, stopChangedBrief } from "#engine/boardBrief.ts";
import { refuseDeliveredId } from "#engine/deliveredId.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { revisedPrompt } from "#engine/revisedPrompt.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { workerBriefText } from "#prompt/task.ts";
import type { Versioned } from "#storage/model.ts";

export const refreshBrief = Effect.fn("Fleet.refreshBrief")(function* (state: EngineState, stored: Versioned<FleetRecord>, work: BoardWork) {
	const ready = stored.value.step === "waiting" && stored.value.decision?.code === "reviewed-pr-ready" && stored.value.result?.kind === "change";
	const reapproved = stored.value.decision?.code === "approval-required";
	const changed = briefChanged(stored.value, work) || preparedSchedulingChanged(stored.value, work);
	if (
		["done", "released"].includes(stored.value.step)
		|| (!(ready || reapproved) && (stored.value.step === "waiting" || stored.value.decision !== undefined))
		|| !work.approved
		|| ["done", "superseded", "deferred", "dropped"].includes(work.status ?? "")
		|| !(changed || reapproved)
	) {
		return stored;
	}
	const owner = (yield* workMetadata(work)).fields.owner;
	if (owner !== undefined && owner !== "codex") {
		return stored;
	}
	if (!ready) {
		return yield* approveBrief(state)(stored, work);
	}
	yield* refuseDeliveredId(state, work);
	const published = yield* ensurePublication(state)(stored);
	return yield* requestRework(state)(
		{
			...published,
			value: {
				...published.value,
				areas: work.areas,
				boardContext: work.context,
				boardRevision: work.revision,
				boardSourcePath: work.sourcePath,
				mergeAreasReleased: undefined,
				sweep: published.value.sweep ?? work.sweep,
			},
		},
		workerBriefText(yield* revisedPrompt(stored.value, work, state.board.get), work.context),
	);
});

function preparedSchedulingChanged(record: FleetRecord, work: BoardWork): boolean {
	return (
		record.step === "queued"
		&& (JSON.stringify(record.areas ?? []) !== JSON.stringify(work.areas ?? [])
			|| JSON.stringify(record.sweep ?? []) !== JSON.stringify(work.sweep ?? []))
	);
}

export const reconcileBrief = Effect.fn("Fleet.reconcileBrief")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (["done", "released"].includes(stored.value.step)) {
		return stored;
	}
	const work = yield* state.board.get(stored.value.workId);
	const refreshed = yield* refreshBrief(state, stored, work);
	return briefChanged(refreshed.value, work) ? yield* stopChangedBrief(state)(refreshed) : refreshed;
});
