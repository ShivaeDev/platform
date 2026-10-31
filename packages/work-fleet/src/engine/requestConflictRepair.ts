import { Effect } from "effect";
import { reviewSatisfied } from "#completion.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { failureContext } from "#engine/failureContext.ts";
import { interruptWork } from "#engine/interruptWork.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileSweepHold } from "#engine/reconcileSweepHold.ts";
import { requestRework } from "#engine/requestRework.ts";
import type { FleetError } from "#errors.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const requestConflictRepair = Effect.fn("Fleet.requestConflictRepair")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	failure: FleetError,
) {
	let current = stored;
	const record = current.value;
	const { code, mainRevision } = failureContext(failure);
	const reviewing = reviewPending(record);
	const active = record.attempts.filter((attempt) => ["submitting", "accepted", "running"].includes(attempt.status));
	if (code !== "pr-conflicting" || (executing(record) && !(reviewing && active.every((attempt) => attempt.role === "reviewer")))) {
		return undefined;
	}
	const held = record.sweepHold === undefined ? undefined : yield* reconcileSweepHold(state, stored);
	if (held !== undefined) {
		return held;
	}
	if (
		mainRevision === undefined
		|| record.result === undefined
		|| (!reviewing && (!reviewSatisfied(record, record.result.head) || record.checks?.passed !== true || record.checks.head !== record.result.head))
		|| record.conflictRepairs?.includes(mainRevision)
	) {
		return undefined;
	}
	yield* authorizeBriefContext(record, yield* state.board.get(record.workId));
	for (const attempt of active) {
		const interrupted = yield* interruptWork(state, attempt);
		current = yield* state.load(record.workId);
		current = yield* state.save(current, {
			...current.value,
			attempts: current.value.attempts.map((saved) => (saved.operationId === attempt.operationId ? { ...saved, ...interrupted } : saved)),
		});
	}
	const resolved = record.decision?.code === "reviewed-pr-ready" ? yield* makeHuman(state)(current) : current;
	if (resolved.value.step === "released") {
		return resolved;
	}
	const changes = resolved.value.step === "repairing" ? `${resolved.value.prompt}\n\n` : "";
	return yield* requestRework(state)(
		resolved,
		`${changes}GitHub reports a conflict with main at ${mainRevision}. Fetch and merge main once, resolve the conflicts, and retain the requested changes.`,
		undefined,
		mainRevision,
	);
});

function reviewPending(record: FleetRecord): boolean {
	return record.step === "reviewing" || (record.decision?.code === "session-stalled" && record.attempts.at(-1)?.role === "reviewer");
}
