import { Context, Effect } from "effect";
import { dual } from "effect/Function";
import type { ReadonlyRecord } from "effect/Record";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { isSqlError, type SqlError } from "effect/sql/SqlError";
import { type BeforeCommit as CommitHook, makeChannel } from "@shivaedev/changes/channel.ts";
import { type Observation, type Observer, unobserved } from "@shivaedev/changes/observe.ts";
import type { Publish } from "@shivaedev/changes/publish.ts";
import { flatten, type Invalidation, keysOf } from "#invalidationKeys.ts";

export type InvalidationKeys = readonly unknown[] | ReadonlyRecord<string, readonly unknown[]>;

export interface AnnouncementOptions {
	readonly publication?: "local" | "shared";
}

type Services = SqlClient.SqlClient | Reactivity.Reactivity;

export const ChangeObserver = Context.Reference<Observer<unknown>>("@shivaedev/sql/ChangeObserver", { defaultValue: () => unobserved });
export const BeforeCommit = Context.Reference<CommitHook<unknown, SqlError, Services>>("@shivaedev/sql/BeforeCommit", {
	defaultValue: () => () => Effect.void,
});
export const CommittedSink = Context.Reference<Publish<unknown, Services> | undefined>("@shivaedev/sql/CommittedSink", {
	defaultValue: () => undefined,
});

function observe(event: Observation<Invalidation>) {
	return Effect.flatMap(ChangeObserver, (observer) => observer({ ...event, changes: keysOf(event.changes) }));
}

function invalidate(keys: readonly unknown[]) {
	return Reactivity.Reactivity.use((reactivity) => Effect.sync(() => reactivity.invalidateUnsafe(keys)));
}

const committed = Effect.fnUntraced(function* (changes: readonly Invalidation[]) {
	const sink = yield* CommittedSink;
	if (sink === undefined) {
		return yield* invalidate(keysOf(changes));
	}
	const shared = keysOf(changes.filter((change) => change.publication === "shared"));
	const sharedKeys = new Set(shared);
	const local = keysOf(changes.filter((change) => change.publication === "local" && !sharedKeys.has(change.key)));
	if (local.length > 0) {
		yield* invalidate(local);
	}
	if (shared.length > 0) {
		yield* sink(shared);
	}
});

const invalidations = makeChannel<Invalidation, Services, SqlError>({
	beforeCommit: (changes) => {
		const shared = keysOf(changes.filter((change) => change.publication === "shared"));
		return shared.length === 0 ? Effect.void : Effect.flatMap(BeforeCommit, (hook) => hook(shared));
	},
	key: (change) => (change.publication === "shared" ? change.key : change),
	name: "@shivaedev/sql/transact",
	owner: Effect.map(SqlClient.SqlClient, (sql) => sql.transactionService),
	publish: (changes) => invalidate(keysOf(changes)),
	unowned: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const native = yield* Effect.serviceOption(sql.transactionService);
		if (native._tag === "Some") {
			return yield* Effect.die(
				new Error("transact cannot announce changes after a transaction it does not own; begin the outer transaction with transact"),
			);
		}
	}),
});

export const invalidateOnCommit = Effect.fn("Transact.invalidateOnCommit")(function* (keys: InvalidationKeys, options?: AnnouncementOptions) {
	yield* invalidations
		.record(flatten(keys).map((key) => ({ key, publication: options?.publication ?? "shared" })))
		.pipe(Effect.provideService(invalidations.Observer, observe));
});

export interface TransactOptions<TError> {
	readonly onSqlError: (error: SqlError) => TError;
}

export const transact: {
	<TError>(
		options: TransactOptions<TError>,
	): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, Exclude<E, SqlError> | TError, R | SqlClient.SqlClient | Reactivity.Reactivity>;
	<A, E, R, TError>(
		effect: Effect.Effect<A, E, R>,
		options: TransactOptions<TError>,
	): Effect.Effect<A, Exclude<E, SqlError> | TError, R | SqlClient.SqlClient | Reactivity.Reactivity>;
} = dual(
	2,
	Effect.fn("Transact.transact")(function* <A, E, R, TError>(effect: Effect.Effect<A, E, R>, options: TransactOptions<TError>) {
		const sql = yield* SqlClient.SqlClient;
		const native = yield* Effect.serviceOption(sql.transactionService);
		return yield* invalidations
			.within((body, boundary) =>
				native._tag === "Some"
					? sql.withTransaction(body)
					: boundary.restore(sql.withTransaction(Effect.tap(body, () => sql.afterCommit(boundary.committed)))),
			)(effect)
			.pipe(
				Effect.provideService(invalidations.Observer, observe),
				Effect.provideService(invalidations.CommittedSink, committed),
				Effect.catchIf(isSqlError, (error) => Effect.fail(options.onSqlError(error))),
			);
	}),
);
