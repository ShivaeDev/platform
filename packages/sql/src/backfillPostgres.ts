import { Data, Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { advisoryXactLock } from "#advisoryXactLock.ts";
import { transact } from "#transact.ts";

export class BackfillInsideTransaction extends Data.TaggedError("BackfillInsideTransaction") {}

export interface BackfillOptions<TRow extends object, TProgress, E, R> {
	readonly batchSize: number;
	readonly loadProgress: Effect.Effect<TProgress, E, R>;
	readonly lock: bigint | string;
	readonly process: (row: TRow) => Effect.Effect<unknown, E, R>;
	readonly saveProgress: (last: TRow, previous: TProgress) => Effect.Effect<unknown, E, R>;
	readonly select: (progress: TProgress, limit: number) => Effect.Effect<readonly TRow[], E, R>;
}

const BatchSize = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));

export const backfillPostgres = Effect.fn("Sql.backfillPostgres")(function* <TRow extends object, TProgress, E, R>(
	options: BackfillOptions<TRow, TProgress, E, R>,
) {
	const sql = yield* SqlClient.SqlClient;
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* new BackfillInsideTransaction();
	}
	const batchSize = yield* Schema.decodeUnknownEffect(BatchSize)(options.batchSize);
	let processed = 0;
	while (true) {
		const count = yield* Effect.gen(function* () {
			yield* advisoryXactLock(options.lock).pipe(Effect.catchTag("AdvisoryLockOutsideTransaction", Effect.die));
			const progress = yield* options.loadProgress;
			const rows = (yield* options.select(progress, batchSize)).slice(0, batchSize);
			for (const row of rows) {
				yield* options.process(row);
			}
			const last = rows.at(-1);
			if (last !== undefined) {
				yield* options.saveProgress(last, progress);
			}
			return rows.length;
		}).pipe(transact({ onSqlError: (error) => error }));
		processed += count;
		if (count === 0) {
			return processed;
		}
	}
});
