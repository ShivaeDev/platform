import { Cause, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { AdvisoryLockOutsideTransaction } from "#advisoryXactLock.ts";
import { Rejected } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"the same bigint advisory key waits until the holding transaction commits",
	[],
	function* ({ advisoryXactLock, holdAdvisoryLock, transact, waitingOn }) {
		const key = 9_223_372_036_854_775_807n;
		const held = yield* holdAdvisoryLock(key);
		const second = yield* advisoryXactLock(key).pipe(transact({ onSqlError: (error) => error }), Effect.forkScoped);
		yield* eventually(waitingOn(held.pid).pipe(Effect.flatMap((waiting) => Effect.try(() => expect(waiting).toBe(true))))).pipe(
			Effect.timeout("3 seconds"),
		);
		yield* held.commit;
		yield* Fiber.join(held.fiber);
		expect(yield* Fiber.join(second).pipe(Effect.timeout("3 seconds"))).toBeUndefined();
	},
);

postgres.it(
	"different advisory keys proceed while a holding transaction remains open",
	[],
	function* ({ advisoryXactLock, holdAdvisoryLock, sql, transact }) {
		const key = crypto.randomUUID();
		const held = yield* holdAdvisoryLock(key);
		expect(
			yield* sql`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as acquired`.pipe(transact({ onSqlError: (error) => error })),
		).toEqual([{ acquired: false }]);
		expect(yield* advisoryXactLock(`${key}:other`).pipe(transact({ onSqlError: (error) => error }), Effect.timeout("3 seconds"))).toBeUndefined();
		expect(held.fiber.pollUnsafe()).toBeUndefined();
		yield* held.commit;
		yield* Fiber.join(held.fiber);
	},
);

postgres.it(
	"string advisory keys use hashtextextended with seed zero and release on rollback",
	[],
	function* ({ advisoryXactLock, holdAdvisoryLock, sql, transact, waitingOn }) {
		const key = crypto.randomUUID();
		const [hashed] = yield* sql<{ key: string }>`select hashtextextended(${key}, 0)::text as key`;
		if (hashed === undefined) {
			return yield* Effect.die("PostgreSQL did not return a hash");
		}
		const held = yield* holdAdvisoryLock(BigInt(hashed.key));
		const second = yield* advisoryXactLock(key).pipe(transact({ onSqlError: (error) => error }), Effect.forkScoped);
		yield* eventually(waitingOn(held.pid).pipe(Effect.flatMap((waiting) => Effect.try(() => expect(waiting).toBe(true))))).pipe(
			Effect.timeout("3 seconds"),
		);
		yield* held.rollback;
		expect(yield* Fiber.join(held.fiber).pipe(Effect.flip)).toBeInstanceOf(Rejected);
		expect(yield* Fiber.join(second).pipe(Effect.timeout("3 seconds"))).toBeUndefined();
	},
);

postgres.it(
	"interrupting the holding fiber releases its transaction advisory lock",
	[],
	function* ({ advisoryXactLock, holdAdvisoryLock, transact, waitingOn }) {
		const key = crypto.randomUUID();
		const held = yield* holdAdvisoryLock(key);
		const second = yield* advisoryXactLock(key).pipe(transact({ onSqlError: (error) => error }), Effect.forkScoped);
		yield* eventually(waitingOn(held.pid).pipe(Effect.flatMap((waiting) => Effect.try(() => expect(waiting).toBe(true))))).pipe(
			Effect.timeout("3 seconds"),
		);
		yield* Fiber.interrupt(held.fiber);
		const exit = yield* Fiber.await(held.fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* Fiber.join(second).pipe(Effect.timeout("3 seconds"))).toBeUndefined();
	},
);

postgres.it("an advisory lock outside a transaction fails with a typed error", [], function* ({ advisoryXactLock }) {
	expect(yield* advisoryXactLock(1n).pipe(Effect.flip)).toBeInstanceOf(AdvisoryLockOutsideTransaction);
	expect(yield* advisoryXactLock("job").pipe(Effect.flip)).toMatchObject({ _tag: "AdvisoryLockOutsideTransaction" });
});
