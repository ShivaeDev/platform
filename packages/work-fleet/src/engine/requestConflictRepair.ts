import { Effect } from "effect";
import { makeHuman } from "#engine/makeHuman.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { ConflictingPr } from "#host/conflictingPr.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const requestConflictRepair = Effect.fn("Fleet.requestConflictRepair")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	failure: FleetFailure,
) {
	const record = stored.value;
	if (
		!(failure instanceof ConflictingPr)
		|| executing(record)
		|| record.review?.verdict !== "approved"
		|| record.review.head !== record.result?.head
		|| record.checks?.passed !== true
		|| record.checks.head !== record.result?.head
		|| record.conflictRepairs?.includes(failure.mainRevision)
	) {
		return undefined;
	}
	const resolved = record.decision?.code === "reviewed-pr-ready" ? yield* makeHuman(state)(stored) : stored;
	if (resolved.value.stage === "released") {
		return resolved;
	}
	const changes = resolved.value.stage === "repairing" ? `${resolved.value.prompt}\n\n` : "";
	return yield* requestRework(state)(
		resolved,
		`${changes}GitHub reports a conflict with main at ${failure.mainRevision}. Fetch and merge main once, resolve the conflicts, and retain the requested changes.`,
		undefined,
		failure.mainRevision,
	);
});
