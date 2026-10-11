import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueWorker } from "#engine/continueWorker.ts";
import type { EngineState } from "#engine/makeState.ts";
import { readResolution } from "#engine/readResolution.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import { executing, type FleetRecord } from "#model.ts";
import { type DecisionResponse, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function resolveCommand(state: EngineState) {
	const { board, policy, load, save } = state;
	return Effect.fn("Fleet.resolve")(function* (workId: string, decisionId: string, responseId: string) {
		const stored = yield* load(workId);
		if (hasResponse(stored.value, decisionId, responseId)) {
			return yield* closeDecisions(state)(stored);
		}
		if (stored.value.decision?.id !== decisionId) {
			return yield* Effect.fail(new FleetFailure({ message: "Decision changed", reason: "stale" }));
		}
		const { action, published, response } = yield* readResolution(board, stored.value.decision, responseId);
		const receipt = {
			...(action === undefined ? {} : { action }),
			decisionId,
			processedAt: policy.now(),
			published,
			questionId: published.questionId,
			questionRevision: published.revision,
			responseId,
			type: response.response.type,
		};
		const responses = [...(stored.value.responses ?? []), receipt];
		if (action === undefined) {
			const blocker =
				response.response.type === "clarify" ? `Human requested clarification: ${responseId}` : `Human deferred this decision: ${responseId}`;
			return yield* save(stored, { ...stored.value, blocker, responses });
		}
		if (action === "continue") {
			return yield* continueWorker(state)(stored, responses, response.body).pipe(Effect.flatMap(closeDecisions(state)));
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
		yield* authorizeResolution(state, stored.value, action);
		const reportFailure = action === "retry" ? yield* workerReportFailure(stored.value, stored.value.decision?.reason ?? "") : undefined;
		if (reportFailure !== undefined) {
			return yield* correctWorkerReport(state)(stored, reportFailure, responses);
		}
		const stage = resolutionStage(stored.value, action);
		return yield* state.save(stored, { ...stored.value, blocker: undefined, decision: undefined, responses, stage });
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

function hasResponse(record: FleetRecord, decisionId: string, responseId: string) {
	const prior = [...(record.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(record.responses ?? [])];
	return prior.some((previous) => previous.decisionId === decisionId && previous.responseId === responseId);
}
