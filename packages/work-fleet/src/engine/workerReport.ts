import { Effect, Result } from "effect";
import type { DecisionCode } from "#DecisionCode.ts";
import { failureCode } from "#engine/failureCode.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resultReport } from "#host/resultReport.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import { FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

const correctionPrompt = [
	"Your completed turn did not contain a valid worker report. Reply only with a corrected report using the result and evidence from that turn.",
	"Include exactly one FLEET_HEAD line containing the full 40-character head SHA of the existing PR, or the exact checked main SHA for no change, immediately before the final FLEET_PR line.",
	"The FLEET_PR value must be the existing GitHub PR URL or none. Do not add text after it. The required ending is:",
	"FLEET_HEAD: <sha>",
	"FLEET_PR: <url or none>",
].join("\n");

export const workerReportFailure = Effect.fn("Fleet.workerReportFailure")(function* (record: FleetRecord, code: DecisionCode | undefined) {
	const latest = record.attempts.at(-1);
	if (record.deliverable === "report" || latest?.role === "reviewer" || latest?.status !== "completed" || executing(record)) {
		return undefined;
	}
	const parsed = yield* resultReport(latest.output ?? "").pipe(Effect.result);
	if (Result.isFailure(parsed)) {
		return failureCode(parsed.failure) === code ? parsed.failure : undefined;
	}
	return code !== undefined && ["worker-report-head-moved", "worker-report-merged-head-mismatch"].includes(code)
		? new FleetFailure({ code, message: "The reported head changed; request a corrected worker report", reason: "stale" })
		: undefined;
});

export function correctWorkerReport(state: EngineState) {
	return Effect.fn("Fleet.correctWorkerReport")(function* (
		stored: Versioned<FleetRecord>,
		failure: FleetFailure,
		responses?: readonly DecisionResponse[],
	) {
		const latest = stored.value.attempts.at(-1);
		if (latest?.receipt === undefined || latest.role === "reviewer" || latest.status !== "completed") {
			return yield* new FleetFailure({ message: "Report execution lacks a completed receipt", reason: "invalid" });
		}
		if (responses === undefined && latest.prompt?.startsWith(correctionPrompt)) {
			return yield* state.decision(stored, failureCode(failure), failure.message, "Retry to request a corrected worker report or safely release");
		}
		return yield* makeLaunch(state)(stored, latest.role, correctionPrompt, {
			responses: responses ?? stored.value.responses ?? [],
			sessionId: latest.receipt.sessionId,
		});
	});
}
