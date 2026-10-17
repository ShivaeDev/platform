import { Cause, Deferred, Effect, Exit, Fiber, Result } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { values } from "./postgres.ts";

const parallelWritesStayPrivate = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const a = yield* Deferred.make<void>();
	const b = yield* Deferred.make<void>();
	function writer(value: string, ready: Deferred.Deferred<void>, other: Deferred.Deferred<void>) {
		return withTestTransaction(
			Effect.gen(function* () {
				yield* sql`insert into notes values (1, ${value})`;
				yield* Deferred.succeed(ready, undefined);
				yield* Deferred.await(other);
				expect(yield* sql`select id, value from notes`).toEqual([{ id: 1, value }]);
				return value;
			}),
		);
	}
	expect(yield* Effect.all([writer("a", a, b), writer("b", b, a)], { concurrency: "unbounded" })).toEqual(["a", "b"]);
	expect(yield* sql`select * from notes`).toEqual([]);
}).pipe(Effect.timeout("5 seconds"));

const savepointsSuppressInvalidations = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	const publications: number[] = [];
	const unregister = reactivity.registerUnsafe(["items"], () => publications.push(1));
	yield* Effect.addFinalizer(() => Effect.sync(unregister));
	yield* withTestTransaction(
		Effect.gen(function* () {
			yield* sql`update items set value = 'outer' where id = 1`;
			yield* transact(
				Effect.gen(function* () {
					yield* sql`update items set value = 'nested' where id = 1`;
					yield* invalidateOnCommit(["items"]);
				}),
				{ onSqlError: (error) => error },
			);
			expect(yield* values).toEqual([{ value: "nested" }]);
			const rejected = yield* transact(Effect.andThen(sql`update items set value = 'rejected' where id = 1`, Effect.fail("rejected")), {
				onSqlError: (error) => error,
			}).pipe(Effect.flip);
			expect(rejected).toBe("rejected");
			expect(yield* values).toEqual([{ value: "nested" }]);
		}),
	);
	expect(yield* values).toEqual([{ value: "seed" }]);
	expect(publications).toEqual([]);
});

const rollbackPreservesExits = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const failure = { reason: "rejected" };
	const defect = new Error("assertion failed");
	for (const ending of [Effect.fail(failure), Effect.die(defect)]) {
		const exit = yield* withTestTransaction(Effect.andThen(sql`update items set value = 'temporary'`, ending)).pipe(Effect.exit);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const reason = Cause.hasFails(exit.cause) ? Cause.findError(exit.cause) : Cause.findDefect(exit.cause);
			expect(Result.isSuccess(reason) && reason.success).toBe(Cause.hasFails(exit.cause) ? failure : defect);
		}
		expect(yield* values).toEqual([{ value: "seed" }]);
	}
	const entered = yield* Deferred.make<void>();
	const fiber = yield* withTestTransaction(
		Effect.gen(function* () {
			yield* sql`update items set value = 'interrupted'`;
			yield* Deferred.succeed(entered, undefined);
			yield* Effect.never;
		}),
	).pipe(Effect.forkScoped);
	yield* Deferred.await(entered);
	yield* Fiber.interrupt(fiber);
	const exit = yield* Fiber.await(fiber);
	expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
	expect(yield* values).toEqual([{ value: "seed" }]);
}).pipe(Effect.timeout("5 seconds"));

export function transactionVerbs(engine: DatabaseEngine) {
	return {
		parallelWritesStayPrivate: () => engine.run(parallelWritesStayPrivate),
		rollbackPreservesExits: () => engine.run(rollbackPreservesExits),
		savepointsSuppressInvalidations: () => engine.run(savepointsSuppressInvalidations),
	};
}
