import { Effect, Option } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reportedRevision } from "#host/reportRevision.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function completeReport(state: EngineState) {
	const { board, save, decision, reportInspection, integrations } = state;
	return Effect.fn("Fleet.completeReport")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		const latest = stored.value.attempts.at(-1);
		if (latest?.receipt === undefined || latest.status !== "completed") {
			return yield* Effect.fail(new BadRequest({ message: "Report execution lacks a completed receipt" }));
		}
		if (Option.isSome(reportInspection)) {
			yield* reportInspection.value.check(work);
		}
		const output = latest.output ?? "";
		if (!output.trim()) {
			return yield* decision(stored, "empty-report", "Report worker returned empty output", "Retry the report worker or safely release this work");
		}
		const revision = reportedRevision(output);
		const recorded = yield* rememberRevision(state, stored, revision);
		const base = stored.value.preparation.baseRevision;
		if (revision === undefined || (revision !== base && !(yield* integrations.isAncestor?.(base, revision) ?? Effect.succeed(false)))) {
			return yield* decision(
				recorded,
				"report-revision",
				`Report revision ${revision ?? "is missing or invalid"}; expected ${base} or a descendant`,
				"Safely release and dispatch the report again from current main",
			);
		}
		const report = yield* board.report(work, { execution: "completed", output, provisioning: "unknown", receipt: latest.receipt });
		return yield* save(recorded, { ...recorded.value, outcome: { evidence: [report.sourcePath] }, report, step: "done" });
	});
}

function rememberRevision({ save }: EngineState, stored: Versioned<FleetRecord>, revision: string | undefined) {
	const latest = stored.value.attempts.at(-1);
	if (revision === undefined || latest?.reportRevision === revision) {
		return Effect.succeed(stored);
	}
	return save(stored, {
		...stored.value,
		attempts: stored.value.attempts.map((attempt) => (attempt === latest ? { ...attempt, reportRevision: revision } : attempt)),
	});
}
