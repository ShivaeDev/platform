import { Effect } from "effect";
import type { ClosedDecision } from "#board/schema.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";

export const settleFinishedDecisions = Effect.fn("FleetHost.settleFinishedDecisions")(function* (namespace: string, dryRun: boolean) {
	const board = yield* BoardGateway;
	if (board.closeFinishedDecisions === undefined) {
		return yield* new BoardFailure({ message: "The Board gateway cannot close finished decisions" });
	}
	const fleet = yield* Fleet;
	const store = yield* answerStore(namespace);
	const candidates: (ClosedDecision & { readonly request: AnswerRequest })[] = [];
	for (const request of yield* store.list()) {
		if (request.error === null) {
			continue;
		}
		const { value: record } = yield* fleet.get(request.work_id);
		const work = yield* board.get(request.work_id);
		const reason = closureReason(record, work.status);
		if (reason !== undefined) {
			candidates.push({ reason, request, sourcePath: record.decision?.published?.sourcePath ?? work.sourcePath, workId: record.workId });
		}
	}
	const closed = yield* board.closeFinishedDecisions({
		dryRun,
		finishedWork: new Map(candidates.map(({ workId, reason }) => [workId, reason])),
	});
	if (!dryRun) {
		for (const { request, reason } of candidates) {
			const current = yield* fleet.get(request.work_id);
			if (!["done", "released"].includes(current.value.step)) {
				yield* fleet.reconcile(request.work_id);
			}
			yield* store.finish(request);
			yield* Effect.logInfo(`Closed failed answer for ${request.work_id}: ${reason}`);
		}
	}
	return [
		...closed,
		...candidates
			.filter(({ workId }) => !closed.some((decision) => decision.workId === workId))
			.map(({ workId, reason, sourcePath }): ClosedDecision => ({ reason, sourcePath, workId })),
	];
});

function closureReason(record: FleetRecord, status: string | undefined) {
	if (["done", "released"].includes(record.step)) {
		return `Closed because Fleet work ${record.workId} is ${record.step}.`;
	}
	if (["done", "deferred", "dropped"].includes(status ?? "")) {
		return `Closed because Board work ${record.workId} is ${status}.`;
	}
	return undefined;
}
