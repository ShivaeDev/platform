import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueWorker } from "#engine/continueWorker.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { resolveExecution } from "#engine/resolveExecution.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import { CONFLICTING_PR_REASON } from "#host/conflictingPr.ts";
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
			const rework = yield* retryRework(state)(current, responses, body);
			if (rework !== undefined) {
				return rework;
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

function retryRework(state: EngineState) {
	return Effect.fn("Fleet.retryRework")(function* (stored: Versioned<FleetRecord>, responses: readonly DecisionResponse[], body: string) {
		const record = stored.value;
		if (record.result?.kind !== "change" || executing(record)) {
			return undefined;
		}
		const latest = record.attempts.at(-1);
		let changes = body.trim();
		if (record.decision?.reason === CONFLICTING_PR_REASON) {
			changes = ["GitHub reports a conflict with main. Fetch and merge main, resolve the conflicts, and retain the requested changes.", changes]
				.filter(Boolean)
				.join("\n\n");
		} else if (latest?.sessionUnusable) {
			changes = [latest.prompt ?? record.prompt, changes].filter(Boolean).join("\n\n");
		} else if (record.decision?.reason !== "Reviewed PR is ready to merge" || !changes) {
			return undefined;
		}
		return yield* requestRework(state)(stored, changes, responses);
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
