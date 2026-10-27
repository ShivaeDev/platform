import { Effect } from "effect";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { inBoardReadPass } from "#board/readPass.ts";
import { interruptWork } from "#engine/interruptWork.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseFinishedWork } from "#engine/releaseFinishedWork.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const STOP_REASON = "Work cancelled";

export function stopCommand(state: EngineState) {
	return Effect.fn("Fleet.stop")(function* (workId: string) {
		const stored = yield* state.load(workId);
		if (["done", "released"].includes(stored.value.step)) {
			return yield* new Forbidden({ message: `Cannot stop ${workId}: work is ${stored.value.step}` });
		}
		const work = yield* state.board.get(workId);
		return yield* stopWork(state, stored, work.status === "dropped" ? `${STOP_REASON} because Board status is dropped.` : undefined);
	}, inBoardReadPass);
}

export const stopWork = Effect.fn("Fleet.stopWork")(function* (
	state: EngineState,
	input: Versioned<FleetRecord>,
	reason = `${STOP_REASON} by orchestrator.`,
) {
	let stored = input;
	if (!stored.value.releaseReason?.startsWith(STOP_REASON)) {
		stored = yield* state.decision(
			{ ...stored, value: { ...stored.value, releaseReason: reason } },
			"fleet-invalid",
			reason,
			"Release Fleet ownership and preserve its branch and pull request",
		);
	}
	for (const attempt of stored.value.attempts) {
		if (["submitting", "accepted", "running"].includes(attempt.status)) {
			const interrupted = yield* interruptWork(state, attempt);
			stored = yield* state.load(input.value.workId);
			stored = yield* state.save(stored, {
				...stored.value,
				attempts: stored.value.attempts.map((saved) => (saved.operationId === attempt.operationId ? { ...saved, ...interrupted } : saved)),
			});
		}
	}
	const decision = stored.value.decision;
	if (decision?.published === undefined || state.board.respond === undefined) {
		return yield* new BoardFailure({ message: "Board gateway must support recording the closing response" });
	}
	const work = yield* state.board.get(stored.value.workId);
	let pr = stored.value.result?.kind === "change" ? stored.value.result.pr : undefined;
	if (pr === undefined && state.integrations.publication !== undefined) {
		pr = (yield* state.integrations.publication(work)).pullRequest;
	}
	const closing = `${stored.value.releaseReason ?? reason}${pr === undefined ? "" : ` Pull request preserved: ${pr}`}`;
	const responseId = yield* state.board.respond({ ...decision, published: decision.published }, "release", closing);
	stored = yield* state.save(stored, {
		...stored.value,
		responses: [
			...(stored.value.responses ?? []),
			{
				action: "release",
				decisionId: decision.id,
				processedAt: state.policy.now(),
				published: decision.published,
				questionId: decision.published.questionId,
				questionRevision: decision.published.revision,
				responseId,
				type: "answer",
			},
		],
	});
	if (pr !== undefined) {
		yield* state.store.reserveForeign(pr, { backlog: true, executing: false });
	}
	return yield* releaseFinishedWork(state, stored, closing);
}, inBoardReadPass);

export const reconcileStop = Effect.fn("Fleet.reconcileStop")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	if (["done", "released"].includes(stored.value.step)) {
		return stored;
	}
	const work = yield* state.board.get(stored.value.workId);
	return work.status === "dropped" || stored.value.releaseReason?.startsWith(STOP_REASON)
		? yield* stopWork(state, stored, `${STOP_REASON} because Board status is dropped.`)
		: stored;
});
