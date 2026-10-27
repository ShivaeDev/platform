import { Clock, Effect } from "effect";
import { waitingOwner } from "#attention.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import { fleetStage, waitingReason } from "#stage.ts";

function item(record: FleetRecord) {
	return {
		attentionOwner: waitingOwner(record),
		execution: {
			attempts: record.attempts.map((attempt) => ({
				finishedAt: attempt.finishedAt,
				fixingCi: (attempt.checkFailures?.length ?? 0) > 0,
				id: attempt.operationId,
				role: attempt.role,
				sessionId: attempt.sessionId ?? attempt.receipt?.sessionId,
				started: attempt.receipt !== undefined,
				startedAt: attempt.startedAt,
				status: attempt.status,
			})),
			mergeReady: record.decision?.code === "reviewed-pr-ready",
			question: record.decision?.code === "worker-question",
			step: record.step,
		},
		prUrl: record.result?.kind === "change" ? record.result.pr : undefined,
		waitingReason: waitingReason(record),
		...(record.review?.document && record.review.head === record.result?.head
			? {
					review: { sourcePath: record.review.document.publication.sourcePath, tldr: record.review.document.tldr },
				}
			: {}),
		stage: fleetStage(record),
		stageEnteredAt: record.stageEnteredAt ?? null,
		updatedAt: record.updatedAt ?? null,
		workId: record.workId,
	};
}
export const fleetItems = Effect.gen(function* () {
	const store = yield* FleetRepository;
	return Effect.gen(function* () {
		const now = yield* Clock.currentTimeMillis;
		const records = (yield* store.list()).map(({ value }) => value);
		return {
			completed: records.flatMap((record) =>
				record.step === "done" && record.completedAt !== undefined && record.completedAt >= now - 7 * 24 * 60 * 60 * 1000 && record.completedAt <= now
					? [{ ...item(record), completedAt: record.completedAt, stage: "done" as const }]
					: [],
			),
			items: records.filter((record) => record.step !== "done" && record.step !== "released").map(item),
		};
	});
});
