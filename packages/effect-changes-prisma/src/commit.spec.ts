import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { postgres, slowCommits } from "#test/prismaTraits.ts";

prisma.it.runIf(postgresEnabled)(
	"an interruption while COMMIT is pending still publishes once the commit lands",
	[postgres(), slowCommits()],
	function* ({ database: { changes, published, orders, waitForCommit } }) {
		const backend = yield* Deferred.make<number>();
		const fiber = yield* Effect.gen(function* () {
			yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
			const [row] = yield* changes.use((db) => db.$queryRawUnsafe<ReadonlyArray<{ pid: number }>>("select pg_backend_pid() as pid"));
			yield* Deferred.succeed(backend, row?.pid ?? -1);
		}).pipe(changes.transaction, Effect.forkChild);
		yield* waitForCommit(yield* Deferred.await(backend));
		expect(yield* orders()).toEqual([]);
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);
