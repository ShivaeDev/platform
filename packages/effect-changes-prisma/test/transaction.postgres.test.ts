import { Cause, Data, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError, TransactionExpired } from "#error.ts";
import { makeChanges } from "#test/support/changes.ts";
import { integration, makeDatabase, orderIds } from "#test/support/database.ts";

class Rejected extends Data.TaggedError("Rejected") {}

integration("changes publish after COMMIT: the sink sees the committed rows from a separate connection", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const seen: Array<readonly string[]> = [];
				const { changes, published } = makeChanges(client, () => Effect.map(orderIds(observer), (ids) => void seen.push(ids)));
				const result = yield* Effect.gen(function* () {
					yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));
					yield* changes.use((db) => db.order.create({ data: { id: "o2", ownerId: "bob", total: 20 } }));
					expect(yield* orderIds(observer)).toEqual([]);
					expect(published).toEqual([]);
					return "saved";
				}).pipe(changes.transaction);
				expect(result).toBe("saved");
				expect(published).toEqual([["ada:orders", "bob:orders"]]);
				expect(seen).toEqual([["o1", "o2"]]);
			}),
		),
	),
);

integration("a failing body rolls back and discards its changes, keeping the typed failure", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const failure = yield* Effect.flip(
					Effect.andThen(
						changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
						Effect.fail(new Rejected()),
					).pipe(changes.transaction),
				);
				expect(failure).toEqual(new Rejected());
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("a COMMIT that fails publishes nothing and fails with PrismaError", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const exit = yield* Effect.exit(
					changes.use((db) => db.invoice.create({ data: { id: "i1", orderId: "missing", ownerId: "ada" } })).pipe(changes.transaction),
				);
				expect(Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof PrismaError).toBe(true);
				expect(yield* Effect.promise(() => observer.invoice.count())).toBe(0);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("interrupting the caller during the body interrupts the body and rolls back", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
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
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("a transaction that outlives its timeout rolls back, publishes nothing and fails with TransactionExpired", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const failure = yield* Effect.flip(
					Effect.andThen(
						changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
						Effect.sleep("300 millis"),
					).pipe((body) => changes.transaction(body, { timeout: 100 })),
				);
				expect(failure).toBeInstanceOf(TransactionExpired);
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);
