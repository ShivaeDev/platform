import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Cause, Data, Effect, Layer, Logger } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";
import { invalidateOnCommit, transact } from "../src/index.ts";

class Unavailable extends Data.TaggedError("Unavailable")<{ readonly reason: string }> {}

test("a failing invalidation after commit is logged and the committed result stands", () => {
	const logged: Array<{ readonly level: string; readonly message: unknown; readonly cause: string }> = [];
	const logger = Logger.make((options) => {
		logged.push({ level: options.logLevel, message: options.message, cause: Cause.pretty(options.cause) });
	});
	return Effect.runPromise(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			yield* sql`create table meals (id integer primary key)`;
			reactivity.registerUnsafe(["meals"], () => {
				throw new Error("subscriber threw");
			});
			const saved = yield* Effect.as(Effect.andThen(sql`insert into meals (id) values (1)`, invalidateOnCommit({ meals: [1] })), "saved").pipe(
				transact({ onSqlError: (error) => new Unavailable({ reason: error.message }) }),
			);
			yield* invalidateOnCommit(["meals"]);
			expect(saved).toBe("saved");
			expect(yield* sql`select id from meals`).toEqual([{ id: 1 }]);
			const failure = { level: "Error", message: [expect.stringContaining("committed")], cause: expect.stringContaining("subscriber threw") };
			expect(logged).toEqual([failure, failure]);
		}).pipe(Effect.provide(Layer.mergeAll(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer, Logger.layer([logger])))),
	);
});
