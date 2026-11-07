import { Effect, type Schema } from "effect";
import type { JobReadOptions } from "#server/adapters/client.ts";
import type { JobPayloadSchema } from "#server/definition.ts";
import { PgBossInspectionReads } from "#server/services/inspection/service.ts";
import { decodeStoredData } from "#server/storedRows.ts";
export const inspectionJobs = Effect.fnUntraced(function* <TName extends string, TPayload extends JobPayloadSchema | typeof Schema.Null>(
	queue: { readonly name: TName; readonly schema: TPayload },
	options?: JobReadOptions,
) {
	const inspection = yield* PgBossInspectionReads;
	const rows = yield* inspection.storedJobs(queue, options);
	return yield* Effect.forEach(rows, (job) => decodeStoredData(queue, job.data).pipe(Effect.map((data) => ({ ...job, data }))));
});
