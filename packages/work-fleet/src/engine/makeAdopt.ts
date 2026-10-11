import { Effect, Result } from "effect";
import { validateResult } from "#completion.ts";
import { completeReport } from "#engine/completeReport.ts";
import type { EngineState } from "#engine/makeState.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeAdopt(state: EngineState) {
	const { integrations, save, decision } = state;
	return Effect.fn("Fleet.makeAdopt")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		if (stored.value.stage !== "adopting") {
			return stored;
		}
		if (work.revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed while work ran", "Approve the current Board scope before adopting this result");
		}
		if (stored.value.deliverable === "report") {
			return yield* completeReport(state)(stored, work);
		}
		const latest = stored.value.attempts.at(-1);
		if (latest?.receipt === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Terminal execution lacks receipt", reason: "invalid" }));
		}
		const adopted = yield* integrations
			.result(work, {
				execution: "completed",
				output: latest.output ?? "",
				provisioning: "unknown",
				receipt: latest.receipt,
			})
			.pipe(Effect.result);
		if (Result.isFailure(adopted)) {
			const failure = yield* workerReportFailure(stored.value, adopted.failure.message);
			if (failure !== undefined) {
				return yield* correctWorkerReport(state)(stored, failure);
			}
			return yield* Effect.fail(adopted.failure);
		}
		const result = adopted.success;
		yield* validateResult(stored.value, result);
		return yield* save(stored, { ...stored.value, checks: undefined, result, review: undefined, stage: "reviewing" });
	});
}
