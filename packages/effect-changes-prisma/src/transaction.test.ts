import { Cause, Data, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError } from "#error.ts";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { postgres, sinkReadsCommittedRows } from "#test/prismaTraits.ts";

class Rejected extends Data.TaggedError("Rejected") {}

prisma.it.runIf(postgresEnabled)(
	"changes publish after COMMIT: the sink sees the committed rows from a separate connection",
	[sinkReadsCommittedRows(), postgres()],
	function* ({ database: { changes, published, seen, orders } }) {
		const result = yield* Effect.gen(function* () {
			yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
			yield* changes.use((db) => db.order.create({ data: { id: "o2", ownerId: "bob", total: 20 } }));
			expect(yield* orders()).toEqual([]);
			expect(published).toEqual([]);
			return "saved";
		}).pipe(changes.transaction);
		expect(result).toBe("saved");
		expect(published).toEqual([["ada:orders", "bob:orders"]]);
		expect(seen).toEqual([["o1", "o2"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a failing body rolls back and discards its changes, keeping the typed failure",
	[postgres()],
	function* ({ database: { changes, published, orders } }) {
		const failure = yield* Effect.flip(
			Effect.andThen(
				changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
				Effect.fail(new Rejected()),
			).pipe(changes.transaction),
		);
		expect(failure).toEqual(new Rejected());
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a COMMIT that fails publishes nothing and fails with PrismaError",
	[postgres()],
	function* ({ database: { observer, changes, published } }) {
		const exit = yield* Effect.exit(
			changes.use((db) => db.invoice.create({ data: { id: "i1", orderId: "missing", ownerId: "ada" } })).pipe(changes.transaction),
		);
		expect(Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof PrismaError).toBe(true);
		expect(yield* Effect.promise(() => observer.invoice.count())).toBe(0);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"interrupting the caller during the body interrupts the body and rolls back",
	[postgres()],
	function* ({ database: { changes, published, orders } }) {
		const written = yield* Deferred.make<void>();
		const fiber = yield* Effect.gen(function* () {
			yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
			yield* Deferred.succeed(written, undefined);
			yield* Effect.sleep("300 millis");
		}).pipe(changes.transaction, Effect.forkChild);
		yield* Deferred.await(written);
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);
