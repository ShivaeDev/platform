import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Cause, Data, Effect, Layer, Logger } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { expect, it } from "vitest";
import { invalidateOnCommit, transact } from "#index.ts";

class Unavailable extends Data.TaggedError("Unavailable")<{ readonly reason: string }> {}

it("a failing invalidation after commit is logged and the committed result stands", () => {
	const logged: Array<{ readonly level: string; readonly message: unknown; readonly cause: string }> = [];
	const logger = Logger.make((options) => {
		logged.push({ cause: Cause.pretty(options.cause), level: options.logLevel, message: options.message });
	});
	return Effect.runPromise(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			yield* sql`create table orders (id integer primary key)`;
			reactivity.registerUnsafe(["orders"], () => {
				throw new Error("subscriber threw");
			});
			const saved = yield* Effect.as(Effect.andThen(sql`insert into orders (id) values (1)`, invalidateOnCommit({ orders: [1] })), "saved").pipe(
				transact({ onSqlError: (error) => new Unavailable({ reason: error.message }) }),
			);
			yield* invalidateOnCommit(["orders"]);
			expect(saved).toBe("saved");
			expect(yield* sql`select id from orders`).toEqual([{ id: 1 }]);
			const failure = { cause: expect.stringContaining("subscriber threw"), level: "Error", message: [expect.stringContaining("committed")] };
			expect(logged).toEqual([failure, failure]);
		}).pipe(Effect.provide(Layer.mergeAll(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer, Logger.layer([logger])))),
	);
});
