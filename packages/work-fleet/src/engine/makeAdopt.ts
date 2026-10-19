import { Effect, Result } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { validateResult } from "#completion.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { completeReport } from "#engine/completeReport.ts";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resultReview } from "#engine/resultReview.ts";
import { correctWorkerReport, workerReportFailure } from "#engine/workerReport.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeAdopt(state: EngineState) {
	const { integrations, save } = state;
	return Effect.fn("Fleet.makeAdopt")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		if (stored.value.stage !== "adopting") {
			return stored;
		}
		yield* authorizeBriefContext(stored.value, work);
		if (stored.value.deliverable === "report") {
			return yield* completeReport(state)(stored, work);
		}
		const latest = stored.value.attempts.at(-1);
		if (latest?.receipt === undefined) {
			return yield* Effect.fail(new BadRequest({ message: "Terminal execution lacks receipt" }));
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
			const failure = yield* workerReportFailure(stored.value, failureCode(adopted.failure));
			if (failure !== undefined) {
				return yield* correctWorkerReport(state)(stored, failure);
			}
			return yield* Effect.fail(adopted.failure);
		}
		const result = adopted.success;
		yield* validateResult(stored.value, result);
		if (
			latest.role === "repair"
			&& latest.checkFailures !== undefined
			&& result.kind === "change"
			&& stored.value.result?.kind === "change"
			&& result.pr === stored.value.result.pr
			&& result.head === stored.value.result.head
			&& stored.value.review?.head === result.head
			&& stored.value.review.verdict === "approved"
		) {
			return yield* save(stored, { ...stored.value, checks: undefined, result, stage: "validating" });
		}
		return yield* save(stored, {
			...stored.value,
			checks: undefined,
			result,
			review: undefined,
			...(yield* resultReview(state, result.head)),
		});
	});
}
