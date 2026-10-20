import { Clock, Effect } from "effect";
import { waitingOwner } from "#attention.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";

function item(record: FleetRecord) {
	return {
		attentionOwner: waitingOwner(record),
		prUrl: record.result?.kind === "change" ? record.result.pr : undefined,
		...(record.review?.document && record.review.head === record.result?.head
			? {
					review: { sourcePath: record.review.document.publication.sourcePath, tldr: record.review.document.tldr },
				}
			: {}),
		stage: record.stage,
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
				record.stage === "completed"
				&& record.completedAt !== undefined
				&& record.completedAt >= now - 7 * 24 * 60 * 60 * 1000
				&& record.completedAt <= now
					? [{ ...item(record), completedAt: record.completedAt, stage: "completed" as const }]
					: [],
			),
			items: records.filter((record) => record.stage !== "completed" && record.stage !== "released").map(item),
		};
	});
});
