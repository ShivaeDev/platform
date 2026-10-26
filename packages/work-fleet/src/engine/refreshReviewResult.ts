import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import { validateResult } from "#completion.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resultReview } from "#engine/resultReview.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function refreshReviewResult(state: EngineState) {
	const { integrations, save, board, decision, policy } = state;
	return Effect.fn("Fleet.refreshReviewResult")(function* (stored: Versioned<FleetRecord>, work: BoardWork, result: WorkResult, head = result.head) {
		const currentWork = yield* board.get(work.workId);
		yield* authorizeBriefContext(stored.value, currentWork);
		const worker = reviewWorker(stored.value);
		if (worker?.receipt === undefined) {
			return yield* withFailureContext(new BadRequest({ message: "Review lacks the adopted worker receipt" }), { code: "worker-receipt-missing" });
		}
		const current = yield* integrations.result(work, {
			execution: "completed",
			output: result.kind === "change" ? `FLEET_HEAD: ${head}\nFLEET_PR: ${result.pr}` : (worker.output ?? ""),
			provisioning: "unknown",
			receipt: worker.receipt,
		});
		yield* validateResult(stored.value, current);
		if (head !== result.head && current.head !== head) {
			return yield* new Conflict({ message: "Current PR result does not match the observed delivery head" });
		}
		if (!sameResultIdentity(current, result)) {
			return yield* decision(
				stored,
				"result-identity-changed",
				"Result identity changed during review",
				"Inspect ownership before adopting a replacement result",
			);
		}
		if (current.head === result.head) {
			return stored;
		}
		return yield* save(stored, {
			...stored.value,
			blocker: undefined,
			checks: undefined,
			decision: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			result: current,
			resultObservations: [...(stored.value.resultObservations ?? []), result],
			...(yield* resultReview(state, current.head)),
			supersededDecisions: supersedeDecision(stored.value, policy.now()),
		});
	});
}

function reviewWorker(record: FleetRecord) {
	const cycles = [record, ...(record.history ?? []).toReversed()];
	for (const cycle of cycles) {
		if (
			cycle.boardRevision !== record.boardRevision
			|| cycle.result === undefined
			|| record.result === undefined
			|| !sameResultIdentity(cycle.result, record.result)
		) {
			continue;
		}
		const worker = cycle.attempts.findLast(
			(attempt) => attempt.role !== "reviewer" && !(attempt.status === "failed" && attempt.receipt === undefined),
		);
		if (worker !== undefined) {
			return worker;
		}
	}
	return undefined;
}

function sameResultIdentity(current: WorkResult, result: WorkResult) {
	return current.kind === result.kind && (current.kind !== "change" || result.kind !== "change" || current.pr === result.pr);
}

function supersedeDecision(record: FleetRecord, supersededAt: number) {
	return record.decision?.published === undefined
		? record.supersededDecisions
		: [...(record.supersededDecisions ?? []), { published: record.decision.published, supersededAt }];
}
