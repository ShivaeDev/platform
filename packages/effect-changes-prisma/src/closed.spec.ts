import { Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError, TransactionExpired } from "#error.ts";
import { postgresEnabled } from "#test/database.ts";
import { expiredIn } from "#test/nativeExpiry.ts";
import { prisma } from "#test/prisma.ts";
import { anotherBinding, postgres, singleConnection } from "#test/prismaTraits.ts";

const closedTransaction = Object.assign(new Error("Transaction already closed"), { code: "P2028" });

prisma.it.runIf(postgresEnabled)(
	"a separate transaction a body starts on the base client does not interrupt the body's transaction when it is closed",
	[postgres()],
	function* ({ database: { client, changes, published, order, orders } }) {
		const closes = Effect.andThen(
			order("o2"),
			changes.use(() => Promise.reject(closedTransaction)),
		);
		const onBase = changes.transaction(closes).pipe(Effect.provideService(changes.Client, client));
		const separate = yield* changes.transaction(
			Effect.gen(function* () {
				yield* order("o1");
				const failure = yield* Effect.flip(onBase);
				yield* order("o3");
				return failure;
			}),
			{ timeout: 10_000 },
		);
		expect(separate).toBeInstanceOf(TransactionExpired);
		expect(yield* orders()).toEqual(["o1", "o3"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a query that finds the enclosing transaction expired stops the body even without a deadline of its own",
	[postgres()],
	function* ({ database: { published, order, orders, expiresInNative } }) {
		const state = { sideEffects: 0 };
		const body = Effect.gen(function* () {
			yield* Effect.sleep("1 second");
			yield* Effect.ignore(order("o1"));
			state.sideEffects += 1;
		});
		const exits = yield* expiresInNative(body);
		expect(expiredIn(exits)).toBe(true);
		expect(state.sideEffects).toBe(0);
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"another binding's transaction that expires inside a body leaves the body's own transaction running",
	[postgres(), anotherBinding()],
	function* ({ database: { changes, published, order, orders, nestedOrder, nestedExpiresInNative } }) {
		const expired = yield* changes.transaction(
			Effect.gen(function* () {
				yield* order("o1");
				const exits = yield* nestedExpiresInNative(Effect.andThen(Effect.sleep("1 second"), Effect.ignore(nestedOrder("o2"))));
				yield* order("o3");
				return expiredIn(exits);
			}),
			{ timeout: 10_000 },
		);
		expect(expired).toBe(true);
		expect(yield* orders()).toEqual(["o1", "o3"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a nested transaction that finds the enclosing transaction expired fails with TransactionExpired and stops the body",
	[postgres()],
	function* ({ database: { changes, published, order, orders, expiresInNative } }) {
		const state = { inner: 0, sideEffects: 0 };
		const inner = Effect.gen(function* () {
			state.inner += 1;
			yield* order("o1");
		});
		const body = Effect.gen(function* () {
			yield* Effect.sleep("1 second");
			yield* Effect.ignore(changes.transaction(inner));
			state.sideEffects += 1;
		});
		const exits = yield* expiresInNative(body);
		expect(expiredIn(exits)).toBe(true);
		expect(state).toEqual({ inner: 0, sideEffects: 0 });
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a transaction that cannot start before maxWait fails with PrismaError and leaves the one holding the connection running",
	[singleConnection(), postgres()],
	function* ({ database: { changes, published, order, orders } }) {
		const holding = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const holder = yield* Effect.forkChild(
			changes.transaction(
				Effect.gen(function* () {
					yield* order("o1");
					yield* Deferred.succeed(holding, undefined);
					yield* Deferred.await(release);
					yield* order("o2");
				}),
				{ timeout: 10_000 },
			),
		);
		yield* Deferred.await(holding);
		const failure = yield* Effect.flip(changes.transaction(order("o3"), { maxWait: 1 }));
		yield* Deferred.succeed(release, undefined);
		const held = yield* Fiber.await(holder);
		expect(failure).toBeInstanceOf(PrismaError);
		expect(Exit.isSuccess(held)).toBe(true);
		expect(yield* orders()).toEqual(["o1", "o2"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);
