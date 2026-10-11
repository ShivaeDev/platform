import { Effect } from "effect";
import { briefChanged, changedBrief, refreshedBrief } from "#engine/boardBrief.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueWorker } from "#engine/continueWorker.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { resolveExecution } from "#engine/resolveExecution.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import { MOVED_PR_HEAD_REASON } from "#host/movedPrHead.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function applyResolution(state: EngineState) {
	const { save } = state;
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
		return yield* retryOrRelease(state)(stored, action, responses, body).pipe(Effect.flatMap(closeDecisions(state)));
	});
}

function retryOrRelease(state: EngineState) {
	return Effect.fn("Fleet.retryOrRelease")(function* (
		stored: Versioned<FleetRecord>,
		action: "retry" | "release",
		responses: readonly DecisionResponse[],
		body: string,
	) {
		const current = yield* resolveExecution(state, stored, action);
		if (action === "retry") {
			if (current.value.decision?.reason === "Reviewed PR is ready to merge" && current.value.result?.kind === "change" && body.trim()) {
				return yield* requestRework(state)(current, body, responses);
			}
			const refreshed = yield* retryChangedBrief(state)(current, responses);
			if (refreshed !== undefined) {
				return refreshed;
			}
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

function retryChangedBrief(state: EngineState) {
	return Effect.fn("Fleet.retryChangedBrief")(function* (stored: Versioned<FleetRecord>, responses: readonly DecisionResponse[]) {
		const work = yield* state.board.get(stored.value.workId);
		if (!briefChanged(stored.value, work)) {
			return undefined;
		}
		if (executing(stored.value)) {
			return yield* state.save(stored, { ...stored.value, blocker: undefined, decision: undefined, responses, stage: "executing" });
		}
		const hasWorker = stored.value.attempts.some((attempt) => attempt.role !== "reviewer" && attempt.receipt !== undefined);
		const refreshed = hasWorker ? changedBrief(stored.value, work) : refreshedBrief(stored.value, work);
		return yield* state.save(stored, {
			...refreshed,
			blocker: undefined,
			decision: undefined,
			responses,
			stage: hasWorker ? "repairing" : "prepared",
		});
	});
}

function deliveryRetry(record: FleetRecord) {
	return (
		record.result?.kind === "change"
		&& (record.decision?.reason === MOVED_PR_HEAD_REASON
			|| (!executing(record) && record.review?.verdict === "approved" && record.checks?.passed === true))
	);
}
