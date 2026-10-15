import { Effect } from "effect";
import { workMetadata } from "#board/readPass.ts";
import { approveBrief } from "#engine/approveBrief.ts";
import { briefChanged, stopChangedBrief } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const refreshBrief = Effect.fn("Fleet.refreshBrief")(function* (state: EngineState, stored: Versioned<FleetRecord>, work: BoardWork) {
	if (
		["completed", "released", "needs-human"].includes(stored.value.stage)
		|| stored.value.decision !== undefined
		|| !work.approved
		|| ["done", "superseded", "deferred"].includes(work.status ?? "")
		|| !briefChanged(stored.value, work)
	) {
		return stored;
	}
	const owner = (yield* workMetadata(work)).fields.owner;
	return owner === undefined || owner === "codex" ? yield* approveBrief(state)(stored, work) : stored;
});

export const reconcileBrief = Effect.fn("Fleet.reconcileBrief")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (["completed", "released"].includes(stored.value.stage)) {
		return stored;
	}
	const work = yield* state.board.get(stored.value.workId);
	const refreshed = yield* refreshBrief(state, stored, work);
	return briefChanged(refreshed.value, work) ? yield* stopChangedBrief(state)(refreshed) : refreshed;
});
