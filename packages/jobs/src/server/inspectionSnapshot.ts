import { Effect } from "effect";
import type { SnapshotQueue, UnfinishedJob } from "#server/inspection.ts";
import { PgBossInspectionReads } from "#server/services/inspection/service.ts";
import { decodeStoredData } from "#server/storedRows.ts";
export const inspectionSnapshot = Effect.fnUntraced(function* <const TQueues extends readonly SnapshotQueue[]>(queues: TQueues) {
	const inspection = yield* PgBossInspectionReads;
	const byName = new Map<string, TQueues[number]>(queues.map((queue) => [queue.name, queue]));
	const rows = yield* inspection.snapshot(queues);
	return yield* Effect.forEach(rows, ({ data, queue: name, ...row }) => {
		const queue = byName.get(name);
		if (queue === undefined) {
			return Effect.die(new Error(`The snapshot returned a job of an unrequested queue ${name}`));
		}
		return decodeStoredData<TQueues[number]["name"], TQueues[number]["schema"]>(queue, data).pipe(
			Effect.map((decoded): UnfinishedJob<TQueues[number]> => ({ ...row, data: decoded, queue: queue.name })),
		);
	});
});
