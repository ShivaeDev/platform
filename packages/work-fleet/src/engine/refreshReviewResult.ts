import { Effect } from "effect";
import { validateResult } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, FleetFailure, type WorkResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function refreshReviewResult({ integrations, save, board, decision }: EngineState) {
	return Effect.fn("Fleet.refreshReviewResult")(function* (stored: Versioned<FleetRecord>, work: BoardWork, result: WorkResult) {
		if ((yield* board.get(work.workId)).revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed during review", "Approve and prepare the current task and criteria");
		}
		const worker = stored.value.attempts.findLast((attempt) => attempt.role !== "reviewer");
		if (worker?.receipt === undefined) {
			return yield* new FleetFailure({ message: "Review lacks the adopted worker receipt", reason: "invalid" });
		}
		const current = yield* integrations.result(work, {
			execution: "completed",
			output: worker.output ?? "",
			provisioning: "unknown",
			receipt: worker.receipt,
		});
		yield* validateResult(stored.value, current);
		if (current.kind !== result.kind || (current.kind === "change" && result.kind === "change" && current.pr !== result.pr)) {
			return yield* decision(stored, "Result identity changed during review", "Inspect ownership before adopting a replacement result");
		}
		if (current.head === result.head) {
			return stored;
		}
		return yield* save(stored, {
			...stored.value,
			checks: undefined,
			result: current,
			resultObservations: [...(stored.value.resultObservations ?? []), result],
		});
	});
}
