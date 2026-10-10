import { Cause, Deferred, Effect, Exit, Fiber, Schedule } from "effect";
import { expect } from "vitest";
import { makeChanges } from "#test/changes.ts";
import { integration, makeDatabase, orderIds } from "#test/database.ts";
import type { PrismaClient } from "#test/generated/client.ts";

function slowCommit(schema: string, seconds: number) {
	return [
		`create function "${schema}".slow_commit() returns trigger language plpgsql as $$ begin perform pg_sleep(${seconds}); return null; end $$`,
		`create constraint trigger slow_commit after insert on "${schema}".changes_prisma_order
		deferrable initially deferred for each row execute function "${schema}".slow_commit()`,
	];
}

function committing(observer: PrismaClient, pid: number) {
	return Effect.promise(() =>
		observer.$queryRawUnsafe<ReadonlyArray<{ state: string | null; query: string }>>(`select state, query from pg_stat_activity where pid = ${pid}`),
	).pipe(
		Effect.flatMap((rows) => (rows.some((row) => row.state === "active" && row.query === "COMMIT") ? Effect.void : Effect.fail("not committing"))),
		Effect.retry({ schedule: Schedule.spaced("5 millis"), times: 2000 }),
	);
}

integration("an interruption while COMMIT is pending still publishes once the commit lands", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, client, observer, execute } = yield* makeDatabase;
				yield* execute(...slowCommit(schema, 1));
				const { changes, published } = makeChanges(client);
				const backend = yield* Deferred.make<number>();
				const fiber = yield* Effect.gen(function* () {
					yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
					const [row] = yield* changes.use((db) => db.$queryRawUnsafe<ReadonlyArray<{ pid: number }>>("select pg_backend_pid() as pid"));
					yield* Deferred.succeed(backend, row?.pid ?? -1);
				}).pipe(changes.transaction, Effect.forkChild);
				yield* committing(observer, yield* Deferred.await(backend));
				expect(yield* orderIds(observer)).toEqual([]);
				yield* Fiber.interrupt(fiber);
				const exit = yield* Fiber.await(fiber);
				expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
				expect(yield* orderIds(observer)).toEqual(["o1"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);
