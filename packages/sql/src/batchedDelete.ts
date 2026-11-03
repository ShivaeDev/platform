import { Data, type Duration, Effect, Option, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import { type FindManyFilter, makeFilter } from "#repositoryFilter.ts";
import { tryPurgeLock } from "#tryPurgeLock.ts";

export interface PurgeLimits {
	readonly batchSize: number;
	readonly maxRows: number;
	readonly pause: Duration.Input;
}

export class BatchedDeleteUnavailable extends Data.TaggedError("BatchedDeleteUnavailable")<{
	readonly reason: "transaction" | "dialect";
}> {}

export const PositiveRowCount = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const Nonnegative = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const Limits = Schema.Struct({ batchSize: PositiveRowCount, maxRows: Nonnegative });

export const runPurgeBatches = Effect.fnUntraced(function* <E, R>(
	tableName: string,
	options: PurgeLimits,
	batch: (limit: number) => Effect.Effect<{ readonly count: number; readonly done: boolean }, E, R>,
	prepare?: Effect.Effect<unknown, E, R>,
) {
	const sql = yield* SqlClient.SqlClient;
	if (sql.driver !== "pg") {
		return yield* new BatchedDeleteUnavailable({ reason: "dialect" });
	}
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* new BatchedDeleteUnavailable({ reason: "transaction" });
	}
	const { batchSize, maxRows } = yield* Schema.decodeUnknownEffect(Limits)(options);
	if (prepare !== undefined) {
		yield* prepare;
	}
	if (maxRows === 0 || !(yield* tryPurgeLock(tableName))) {
		return 0;
	}
	let removed = 0;
	while (removed < maxRows) {
		const { count, done } = yield* batch(Math.min(batchSize, maxRows - removed));
		removed += count;
		if (done || count === 0 || removed === maxRows) {
			break;
		}
		yield* Effect.sleep(options.pause);
	}
	return removed;
});

export interface BatchedDeleteOptions<TModel extends Model.Any> extends PurgeLimits {
	readonly where: FindManyFilter<TModel>;
}

export interface BatchedDelete<TModel extends Model.Any> {
	readonly deleteBatched: (
		options: BatchedDeleteOptions<TModel>,
	) => Effect.Effect<number, SqlError | Schema.SchemaError | BatchedDeleteUnavailable, TModel["fields"][keyof TModel["fields"]]["EncodingServices"]>;
}

export const makeBatchedDelete = Effect.fnUntraced(function* (
	model: Model.Any,
	{ tableName, spanPrefix }: { readonly tableName: string; readonly spanPrefix: string },
	changes: RepositoryChanges,
) {
	const sql = yield* SqlClient.SqlClient;
	const { where } = yield* makeFilter(model);
	function deleteBatch(predicate: Fragment, limit: number) {
		const count = SqlSchema.findOne({
			execute: (batchLimit) => sql`with removed as (
				delete from ${sql(tableName)} where (tableoid, ctid) in (
					select tableoid, ctid from ${sql(tableName)} where ${predicate} limit ${batchLimit} for update skip locked
				) returning 1
			) select count(*)::text as count from removed`,
			Request: Schema.Number,
			Result: Schema.Struct({ count: Schema.NumberFromString }),
		});
		return changes.write(
			Effect.gen(function* () {
				const result = yield* count(limit).pipe(Effect.catchTag("NoSuchElementError", Effect.die));
				yield* changes.recordTable(result.count);
				return result.count;
			}),
		);
	}

	return (options: BatchedDeleteOptions<Model.Any>) =>
		Effect.gen(function* () {
			const predicate = yield* Effect.cached(where(options.where, true, true));
			return yield* runPurgeBatches(
				tableName,
				options,
				(limit) =>
					Effect.gen(function* () {
						const count = yield* deleteBatch(yield* predicate, limit);
						return { count, done: count < limit };
					}),
				predicate,
			);
		}).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.scoped, Effect.withSpan(`${spanPrefix}.deleteBatched`));
});
