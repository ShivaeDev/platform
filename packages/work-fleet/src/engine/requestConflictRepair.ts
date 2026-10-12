import { Effect } from "effect";
import { failureContext } from "#engine/failureContext.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import type { FleetError } from "#errors.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const requestConflictRepair = Effect.fn("Fleet.requestConflictRepair")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	failure: FleetError,
) {
	const record = stored.value;
	const { mainRevision } = failureContext(failure);
	if (
		mainRevision === undefined
		|| executing(record)
		|| record.review?.verdict !== "approved"
		|| record.review.head !== record.result?.head
		|| record.checks?.passed !== true
		|| record.checks.head !== record.result?.head
		|| record.conflictRepairs?.includes(mainRevision)
	) {
		return undefined;
	}
	const resolved = record.decision?.reason === "Reviewed PR is ready to merge" ? yield* makeHuman(state)(stored) : stored;
	if (resolved.value.stage === "released") {
		return resolved;
	}
	const changes = resolved.value.stage === "repairing" ? `${resolved.value.prompt}\n\n` : "";
	return yield* requestRework(state)(
		resolved,
		`${changes}GitHub reports a conflict with main at ${mainRevision}. Fetch and merge main once, resolve the conflicts, and retain the requested changes.`,
		undefined,
		mainRevision,
	);
});
