import { Cause, Data, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError, TransactionExpired } from "#error.ts";
import { prisma } from "#test/prisma.ts";

class Rejected extends Data.TaggedError("Rejected") {}

prisma.it(
	"changes publish after COMMIT: the sink sees the committed rows from a separate connection",
	[],
	function* ({ published, seen, use, transaction, orderIds }) {
		const result = yield* Effect.gen(function* () {
			yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
			yield* use((db) => db.order.create({ data: { id: "o2", ownerId: "bob", total: 20 } }));
			expect(yield* orderIds()).toEqual([]);
			expect(published()).toEqual([]);
			return "saved";
		}).pipe(transaction);
		expect(result).toBe("saved");
		expect(published()).toEqual([["ada:orders", "bob:orders"]]);
		expect(seen).toEqual([["o1", "o2"]]);
	},
);

prisma.it("a failing body rolls back and discards its changes, keeping the typed failure", [], function* ({ published, use, transaction, orderIds }) {
	const failure = yield* Effect.flip(
		Effect.andThen(
			use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
			Effect.fail(new Rejected()),
		).pipe(transaction),
	);
	expect(failure).toEqual(new Rejected());
	expect(yield* orderIds()).toEqual([]);
	expect(published()).toEqual([]);
});

prisma.it("a COMMIT that fails publishes nothing and fails with PrismaError", [], function* ({ observer, published, use, transaction }) {
	const exit = yield* Effect.exit(use((db) => db.invoice.create({ data: { id: "i1", orderId: "missing", ownerId: "ada" } })).pipe(transaction));
	expect(Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof PrismaError).toBe(true);
	expect(yield* Effect.promise(() => observer.invoice.count())).toBe(0);
	expect(published()).toEqual([]);
});

prisma.it("interrupting the caller during the body interrupts the body and rolls back", [], function* ({ published, use, transaction, orderIds }) {
	const written = yield* Deferred.make<void>();
	const fiber = yield* Effect.gen(function* () {
		yield* use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
		yield* Deferred.succeed(written, undefined);
		yield* Effect.sleep("300 millis");
	}).pipe(transaction, Effect.forkChild);
	yield* Deferred.await(written);
	yield* Fiber.interrupt(fiber);
	const exit = yield* Fiber.await(fiber);
	expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
	expect(yield* orderIds()).toEqual([]);
	expect(published()).toEqual([]);
});

prisma.it(
	"a transaction that outlives its timeout rolls back, publishes nothing and fails with TransactionExpired",
	[],
	function* ({ published, use, transaction, orderIds }) {
		const failure = yield* Effect.flip(
			Effect.andThen(
				use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
				Effect.sleep("300 millis"),
			).pipe((body) => transaction(body, { timeout: 100 })),
		);
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);
