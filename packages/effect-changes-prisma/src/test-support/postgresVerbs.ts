import { Effect } from "effect";
import type { TransactionOptions } from "#model.ts";
import { tableWrites, writtenTables } from "#tables.ts";
import { committing } from "./committing.ts";
import { orderIds } from "./database.ts";
import { nativeExpiry } from "./nativeExpiry.ts";
import { nativeTransaction } from "./nativeTransaction.ts";
import { pendingWrite } from "./pendingWrite.ts";
import type { PostgresEngine } from "./postgresEngine.ts";
import { reusedConnection } from "./reusedConnection.ts";
import { timed, transactionProbe } from "./transactionProbe.ts";

export function postgresVerbs(
	engine: () => PostgresEngine,
	tell: (line: string) => void,
	other: () => { client: PostgresEngine["client"]; changes: PostgresEngine["changes"] },
) {
	const use: PostgresEngine["changes"]["use"] = (query) => {
		tell("Prisma runs the application query");
		return engine().changes.use(query);
	};
	function changes() {
		return {
			...engine().changes,
			transaction: <A, E, R>(body: Effect.Effect<A, E, R>, options?: TransactionOptions) => {
				tell("the binding runs a transaction");
				return engine().changes.transaction(body, options);
			},
			use,
		};
	}
	return {
		get changes() {
			return changes();
		},
		get checked() {
			return engine().checked;
		},
		get client() {
			return engine().client;
		},
		expires: (options?: TransactionOptions) =>
			Effect.gen(function* () {
				const { state, body } = transactionProbe("2 seconds");
				const { result: failure, elapsed } = yield* timed(
					Effect.flip(
						changes()
							.transaction(body(changes().use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }))), options)
							.pipe(Effect.provideService(changes().Client, engine().current)),
					),
				);
				return { elapsed, failure, state };
			}),
		expiresInNative: <A, E>(body: Effect.Effect<A, E>) => nativeExpiry(engine(), body),
		nestedExpiresInNative: <A, E>(body: Effect.Effect<A, E>) => nativeExpiry(other(), body),
		nestedOrder: (id: string) => other().changes.use((db) => db.order.create({ data: { id, ownerId: "ada", total: 1 } })),
		get observations() {
			return engine().observations;
		},
		get observe() {
			return engine().observe;
		},
		get observer() {
			return engine().observer;
		},
		order: (id: string, ownerId = "ada", total = 1) => changes().use((db) => db.order.create({ data: { id, ownerId, total } })),
		orders: () => orderIds(engine().observer),
		get published() {
			return engine().published;
		},
		reusedConnection: (write: boolean) => {
			tell("two native transactions reuse the client's connection");
			return reusedConnection(engine(), write);
		},
		rollback: <A, E>(body: Effect.Effect<A, E>) =>
			nativeTransaction(
				engine(),
				() =>
					Effect.andThen(
						body,
						Effect.sync(() => engine().published.map((batch) => [...batch])),
					),
				true,
			),
		get schema() {
			return engine().schema;
		},
		get seen() {
			return engine().seen;
		},
		startOrderWrite: () => pendingWrite(engine()),
		get tables() {
			return engine().tables;
		},
		get unnamed() {
			return engine().unnamed;
		},
		waitForCommit: (pid: number) => committing(engine().observer, pid),
		writtenBy: <A, E>(body: Effect.Effect<A, E>) =>
			nativeTransaction(
				engine(),
				(tx) =>
					Effect.gen(function* () {
						const since = yield* tableWrites(tx);
						yield* engine().observe(body);
						return yield* writtenTables(tx, since);
					}),
				true,
			),
	};
}
