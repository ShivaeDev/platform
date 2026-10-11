import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueWorker } from "#engine/continueWorker.ts";
import type { EngineState } from "#engine/makeState.ts";
import { refreshDecision } from "#engine/refreshDecision.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function applyResolution(state: EngineState) {
	const { board, save } = state;
	return Effect.fn("Fleet.applyResolution")(function* (
		stored: Versioned<FleetRecord>,
		responses: readonly DecisionResponse[],
		action: DecisionResponse["action"],
		body: string,
		responseId: string,
	) {
		if (action === undefined) {
			const blocker =
				responses.at(-1)?.type === "clarify" ? `Human requested clarification: ${responseId}` : `Human deferred this decision: ${responseId}`;
			return yield* save(stored, { ...stored.value, blocker, responses });
		}
		if (action === "continue") {
			return yield* continueWorker(state)(stored, responses, body).pipe(Effect.flatMap(closeDecisions(state)));
		}
		if (action === "retry") {
			const work = yield* board.get(stored.value.workId);
			const sourcePath = stored.value.decision?.publicationWork?.sourcePath ?? stored.value.boardSourcePath;
			if (work.revision !== stored.value.decision?.published?.workRevision || (sourcePath !== undefined && sourcePath !== work.sourcePath)) {
				return yield* refreshDecision(state)(stored, responses, work);
			}
		}
		yield* authorizeResolution(state, stored.value, action);
		const stage = resolutionStage(stored.value, action);
		const updated = yield* save(stored, { ...stored.value, blocker: undefined, decision: undefined, responses, stage });
		return yield* closeDecisions(state)(updated);
	});
}

function resolutionStage(record: FleetRecord, action: "retry" | "release"): FleetRecord["stage"] {
	if (action === "release") {
		return "released";
	}
	if (record.deliverable === "report" && !executing(record)) {
		const latest = record.attempts.at(-1);
		return latest?.status === "completed" && latest.output?.trim() ? "adopting" : "prepared";
	}
	if (record.attempts.at(-1)?.role === "reviewer") {
		return "reviewing";
	}
	if (executing(record)) {
		return "executing";
	}
	if (record.result !== undefined) {
		return "reviewing";
	}
	return record.attempts.at(-1)?.status === "completed" ? "adopting" : "prepared";
}
