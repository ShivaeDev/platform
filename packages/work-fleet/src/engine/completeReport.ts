import { Effect, Option } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function completeReport({ board, save, decision, reportInspection }: EngineState) {
	return Effect.fn("Fleet.completeReport")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		const latest = stored.value.attempts.at(-1);
		if (latest?.receipt === undefined || latest.status !== "completed") {
			return yield* Effect.fail(new FleetFailure({ message: "Report execution lacks a completed receipt", reason: "invalid" }));
		}
		if (Option.isSome(reportInspection)) {
			yield* reportInspection.value.check(work);
		}
		const output = latest.output ?? "";
		if (!output.trim()) {
			return yield* decision(stored, "Report worker returned empty output", "Retry the report worker or safely release this work");
		}
		const report = yield* board.report(work, { execution: "completed", output, provisioning: "unknown", receipt: latest.receipt });
		return yield* save(stored, { ...stored.value, outcome: { evidence: [report.sourcePath] }, report, stage: "completed" });
	});
}
