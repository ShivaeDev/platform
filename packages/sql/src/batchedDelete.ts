import { Data, type Duration, Effect, Option, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import { type FindManyFilter, makeFilter } from "#repositoryFilter.ts";
import { tryPurgeLock } from "#tryPurgeLock.ts";

export interface BatchedDeleteOptions<TModel extends Model.Any> {
	readonly batchSize: number;
	readonly maxRows: number;
	readonly pause: Duration.Input;
	readonly where: FindManyFilter<TModel>;
}

export class BatchedDeleteUnavailable extends Data.TaggedError("BatchedDeleteUnavailable")<{
	readonly reason: "transaction" | "dialect";
}> {}

export interface BatchedDelete<TModel extends Model.Any> {
	readonly deleteBatched: (
		options: BatchedDeleteOptions<TModel>,
	) => Effect.Effect<number, SqlError | Schema.SchemaError | BatchedDeleteUnavailable, TModel["fields"][keyof TModel["fields"]]["EncodingServices"]>;
}

const Positive = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const Nonnegative = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const Limits = Schema.Struct({ batchSize: Positive, maxRows: Nonnegative });

export const makeBatchedDelete = Effect.fnUntraced(function* (
	model: Model.Any,
	{ tableName, spanPrefix }: { readonly tableName: string; readonly spanPrefix: string },
	changes: RepositoryChanges,
) {
	const sql = yield* SqlClient.SqlClient;
	const { where } = makeFilter(model, sql);
	const available = Effect.gen(function* () {
		if (sql.driver !== "pg") {
			return yield* new BatchedDeleteUnavailable({ reason: "dialect" });
		}
		if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
			return yield* new BatchedDeleteUnavailable({ reason: "transaction" });
		}
	});
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

	const runBatches = Effect.fnUntraced(function* (options: BatchedDeleteOptions<Model.Any>, predicate: Fragment) {
		const { batchSize, maxRows } = options;
		let removed = 0;
		while (removed < maxRows) {
			const limit = Math.min(batchSize, maxRows - removed);
			const count = yield* deleteBatch(predicate, limit);
			removed += count;
			if (count < limit || removed === maxRows) {
				break;
			}
			yield* Effect.sleep(options.pause);
		}
		return removed;
	});

	return (options: BatchedDeleteOptions<Model.Any>) =>
		Effect.gen(function* () {
			yield* available;
			const { maxRows } = yield* Schema.decodeUnknownEffect(Limits)(options);
			const predicate = yield* where(options.where, true, true);
			if (maxRows === 0) {
				return 0;
			}
			if (!(yield* tryPurgeLock(tableName).pipe(Effect.provideService(SqlClient.SqlClient, sql)))) {
				return 0;
			}
			return yield* runBatches(options, predicate);
		}).pipe(Effect.scoped, Effect.withSpan(`${spanPrefix}.deleteBatched`));
});
