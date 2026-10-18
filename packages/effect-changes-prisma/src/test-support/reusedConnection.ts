import { Effect } from "effect";
import { tableWrites, writtenTables } from "#tables.ts";
import { type NativeTransaction, nativeTransaction } from "./nativeTransaction.ts";
import type { PostgresEngine } from "./postgresEngine.ts";

function backend(tx: NativeTransaction) {
	return Effect.map(
		Effect.promise(() => tx.$queryRawUnsafe<ReadonlyArray<{ readonly pid: number }>>("select pg_backend_pid() as pid")),
		([row]) => row?.pid,
	);
}

export const reusedConnection = Effect.fn("PrismaStory.reusedConnection")(function* (engine: PostgresEngine, write: boolean) {
	const earlier = yield* nativeTransaction(engine, (tx) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => tx.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } }));
			yield* Effect.promise(() => tx.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } }));
			return yield* backend(tx);
		}),
	);
	return yield* nativeTransaction(engine, (tx) =>
		Effect.gen(function* () {
			const since = yield* tableWrites(tx);
			if (write) {
				yield* Effect.promise(() => tx.order.create({ data: { id: "o2", ownerId: "bob", total: 2 } }));
			}
			return { cumulative: yield* writtenTables(tx), earlier, later: yield* backend(tx), written: yield* writtenTables(tx, since) };
		}),
	);
});
