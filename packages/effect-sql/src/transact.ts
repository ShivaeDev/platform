import { makeChannel } from "@shivaedev/effect-changes";
import { Effect, Hash } from "effect";
import { dual } from "effect/Function";
import type { ReadonlyRecord } from "effect/Record";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError";

export type InvalidationKeys = ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>;

const hashOf = (value: unknown): unknown =>
	typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean"
		? String(value)
		: Hash.hash(value);

const isList = (keys: InvalidationKeys): keys is ReadonlyArray<unknown> => Array.isArray(keys);

const flatten = (keys: InvalidationKeys): ReadonlyArray<unknown> =>
	isList(keys) ? keys : Object.entries(keys).flatMap(([name, ids]) => [name, ...ids.map((id) => `${name}:${hashOf(id)}`)]);

const nativeTransactionWithoutTransact = Effect.fn("Transact.guard")(function* () {
	const sql = yield* SqlClient.SqlClient;
	const native = yield* Effect.serviceOption(sql.transactionService);
	if (native._tag === "Some") {
		return yield* Effect.die(
			new Error("transact cannot announce changes after a transaction it does not own; begin the outer transaction with transact"),
		);
	}
});

const invalidations = makeChannel<unknown, SqlClient.SqlClient | Reactivity.Reactivity>({
	name: "@shivaedev/effect-sql/transact",
	owner: Effect.map(SqlClient.SqlClient, (sql) => sql.transactionService),
	publish: (keys) => Reactivity.invalidate(keys),
	unowned: nativeTransactionWithoutTransact(),
});

export const invalidateOnCommit = Effect.fn("Transact.invalidateOnCommit")(function* (keys: InvalidationKeys) {
	yield* invalidations.record(flatten(keys));
});

export interface TransactOptions<E2> {
	readonly onSqlError: (error: SqlError) => E2;
}

const run = Effect.fn("Transact.transact")(function* <A, E, R, E2>(effect: Effect.Effect<A, E, R>, options: TransactOptions<E2>) {
	const sql = yield* SqlClient.SqlClient;
	return yield* invalidations
		.within(sql.withTransaction)(effect)
		.pipe(Effect.catchIf(isSqlError, (error) => Effect.fail(options.onSqlError(error))));
});

export const transact: {
	<E2>(
		options: TransactOptions<E2>,
	): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, Exclude<E, SqlError> | E2, R | SqlClient.SqlClient | Reactivity.Reactivity>;
	<A, E, R, E2>(
		effect: Effect.Effect<A, E, R>,
		options: TransactOptions<E2>,
	): Effect.Effect<A, Exclude<E, SqlError> | E2, R | SqlClient.SqlClient | Reactivity.Reactivity>;
} = dual(2, run);
