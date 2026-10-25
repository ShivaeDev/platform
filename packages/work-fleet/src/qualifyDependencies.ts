import { Effect, Result } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { workRevision } from "#board/workRevision.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetCycleSnapshot, FleetRecord } from "#model.ts";
import type { BoardFailure, BoardWork } from "#policy.ts";

export const qualifyDependencies = Effect.fn("Fleet.qualifyDependencies")(function* (
	references: readonly string[],
	records: readonly FleetRecord[],
	get: (workId: string) => Effect.Effect<BoardWork, BoardFailure>,
) {
	const unmet = yield* Effect.forEach(references, (reference) =>
		Effect.gen(function* () {
			const [workId, criterion] = reference.split("#");
			if (!workId) {
				return `Dependency reference is invalid: ${reference}`;
			}
			const current = yield* get(workId).pipe(Effect.result);
			if (Result.isFailure(current)) {
				return `Dependency ${reference} is unavailable or ambiguous: ${current.failure.message}`;
			}
			if (current.success.workId !== workId) {
				return `Dependency identity is ambiguous: ${reference}`;
			}
			if (criterion !== undefined) {
				return `Dependency ${reference} needs criterion-specific accepted evidence; a whole-work outcome cannot satisfy it`;
			}
			const record = records.find((entry) => entry.workId === workId);
			const missing = dependencyMissing(current.success, record);
			return missing === undefined ? undefined : `waiting for dependency ${reference}: ${missing}`;
		}),
	);
	const blockers = unmet.filter((message) => message !== undefined);
	if (blockers.length > 0) {
		return yield* Effect.fail(
			withFailureContext(new Forbidden({ message: blockers.join("; ") }), { attentionOwner: "automation", expectedWait: true }),
		);
	}
});

function merged(cycle: FleetRecord | FleetCycleSnapshot): boolean {
	return cycle.mergedDelivery !== undefined || (cycle.step === "done" && cycle.outcome !== undefined && "url" in cycle.outcome);
}

function dependencyMissing(current: BoardWork, record: FleetRecord | undefined): string | undefined {
	if (record !== undefined && [record, ...(record.history ?? [])].some(merged)) {
		return;
	}
	const active = record !== undefined && record.step !== "done" && record.step !== "released";
	if (current.status === "done" && !active) {
		return;
	}
	if (record?.step === "done" && record.outcome !== undefined) {
		if (workRevision(record.boardRevision, record.boardContext) === workRevision(current.revision, current.context)) {
			return;
		}
		return `accepted outcome covers an earlier Board revision; current revision is ${current.revision} and not done on the Board`;
	}
	if (active) {
		return `Fleet work is still active (${record.step}); no merged delivery or accepted outcome`;
	}
	return record?.step === "released" ? "released without a merged delivery and not done on the Board" : "not done on the Board; no accepted outcome";
}
