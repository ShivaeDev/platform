import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import { readResolution } from "#engine/readResolution.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
export function resolveCommand(state: EngineState) {
	const { board, policy, load, save } = state;
	return Effect.fn("Fleet.resolve")(function* (workId: string, decisionId: string, responseId: string) {
		const stored = yield* load(workId);
		const prior = [...(stored.value.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(stored.value.responses ?? [])];
		if (prior.some((previous) => previous.decisionId === decisionId && previous.responseId === responseId)) {
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
	if (record.deliverySubmitted && !executing(record)) {
		return "delivering";
	}
	if (record.attempts.at(-1)?.role === "reviewer") {
		return "reviewing";
	}
	if (executing(record)) {
		return "executing";
	}
	if (record.deliverySubmitted) {
		return "delivering";
	}
	return record.result === undefined ? "prepared" : "reviewing";
}
