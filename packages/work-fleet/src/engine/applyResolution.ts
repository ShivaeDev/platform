import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueWorker } from "#engine/continueWorker.ts";
import type { EngineState } from "#engine/makeState.ts";
import { refreshDecision } from "#engine/refreshDecision.ts";
import { releaseExecution } from "#engine/releaseExecution.ts";
import { retireUnacknowledged } from "#engine/retireUnacknowledged.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import { MOVED_PR_HEAD_REASON } from "#host/movedPrHead.ts";
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
		return yield* retryOrRelease(state)(stored, action, responses).pipe(Effect.flatMap(closeDecisions(state)));
	});
}

function retryOrRelease(state: EngineState) {
	return Effect.fn("Fleet.retryOrRelease")(function* (
		stored: Versioned<FleetRecord>,
		action: "retry" | "release",
		responses: readonly DecisionResponse[],
	) {
		if (action === "retry") {
			yield* authorizeResolution(state, stored.value, action);
		}
		const fenced = yield* retireUnacknowledged(state, stored);
		const current = action === "release" && executing(fenced.value) ? yield* releaseExecution(state, fenced) : fenced;
		if (action === "release") {
			yield* authorizeResolution(state, current.value, action);
		}
		const stage = resolutionStage(current.value, action);
		const reportFailure =
			action === "retry" && stage !== "delivering" ? yield* workerReportFailure(current.value, current.value.decision?.reason ?? "") : undefined;
		if (reportFailure !== undefined) {
			return yield* correctWorkerReport(state)(current, reportFailure, responses);
		}
		return yield* state.save(current, { ...current.value, blocker: undefined, decision: undefined, responses, stage });
	});
}

function resolutionStage(record: FleetRecord, action: "retry" | "release"): FleetRecord["stage"] {
	if (action === "release") {
		return "released";
	}
	if (deliveryRetry(record)) {
		return "delivering";
	}

	if (record.attempts.at(-1)?.status === "completed" && record.attempts.at(-1)?.receipt === undefined) {
		return "executing";
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

function deliveryRetry(record: FleetRecord) {
	return (
		record.result?.kind === "change"
		&& (record.decision?.reason === MOVED_PR_HEAD_REASON
			|| (!executing(record) && record.review?.verdict === "approved" && record.checks?.passed === true))
	);
}
