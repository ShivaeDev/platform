import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { commitTakesItsTime } from "#test/prismaTraits.ts";

prisma.it(
	"an interruption while COMMIT is pending still publishes once the commit lands",
	[commitTakesItsTime()],
	function* ({ published, use, transaction, orderIds, committing }) {
		const backend = yield* Deferred.make<number>();
		const fiber = yield* Effect.gen(function* () {
			yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
			const [row] = yield* use((db) => db.$queryRawUnsafe<ReadonlyArray<{ pid: number }>>("select pg_backend_pid() as pid"));
			yield* Deferred.succeed(backend, row?.pid ?? -1);
		}).pipe(transaction, Effect.forkChild);
		yield* committing(yield* Deferred.await(backend));
		expect(yield* orderIds()).toEqual([]);
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* orderIds()).toEqual(["o1"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);
