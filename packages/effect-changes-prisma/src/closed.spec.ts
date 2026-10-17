import { Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError, TransactionExpired } from "#error.ts";
import { createOrder, expiredIn, harnessed } from "#test/expiry.ts";
import { prisma } from "#test/prisma.ts";
import { clientIsConfigured } from "#test/prismaTraits.ts";

const closedTransaction = Object.assign(new Error("Transaction already closed"), { code: "P2028" });

prisma.it(
	"a separate transaction a body starts on the base client does not interrupt the body's transaction when it is closed",
	[],
	function* ({ client, changes, published, use, transaction, order, orderIds }) {
		const closes = Effect.andThen(
			order("o2"),
			use(() => Promise.reject(closedTransaction)),
		);
		const onBase = transaction(closes).pipe(Effect.provideService(changes.Client, client));
		const separate = yield* transaction(
			Effect.gen(function* () {
				yield* order("o1");
				const failure = yield* Effect.flip(onBase);
				yield* order("o3");
				return failure;
			}),
			{ timeout: 10_000 },
		);
		expect(separate).toBeInstanceOf(TransactionExpired);
		expect(yield* orderIds()).toEqual(["o1", "o3"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);

prisma.it(
	"a query that finds the enclosing transaction expired stops the body even without a deadline of its own",
	[],
	function* ({ client, changes, published, order, orderIds }) {
		const state = { sideEffects: 0 };
		const body = Effect.gen(function* () {
			yield* Effect.sleep("1 second");
			yield* Effect.ignore(order("o1"));
			state.sideEffects += 1;
		});
		const { exits, run } = yield* harnessed(changes, body);
		yield* Effect.promise(() => client.$transaction(run, { timeout: 100 }).catch(() => undefined));
		expect(expiredIn(exits)).toBe(true);
		expect(state.sideEffects).toBe(0);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"another binding's transaction that expires inside a body leaves the body's own transaction running",
	[],
	function* ({ published, transaction, order, orderIds, anotherBinding }) {
		const { client: other, changes: nested } = yield* anotherBinding();
		const expired = yield* transaction(
			Effect.gen(function* () {
				yield* order("o1");
				const { exits, run } = yield* harnessed(nested, Effect.andThen(Effect.sleep("1 second"), Effect.ignore(createOrder(nested, "o2"))));
				yield* Effect.promise(() => other.$transaction(run, { timeout: 100 }).catch(() => undefined));
				yield* order("o3");
				return expiredIn(exits);
			}),
			{ timeout: 10_000 },
		);
		expect(expired).toBe(true);
		expect(yield* orderIds()).toEqual(["o1", "o3"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);

prisma.it(
	"a nested transaction that finds the enclosing transaction expired fails with TransactionExpired and stops the body",
	[],
	function* ({ client, changes, published, transaction, order, orderIds }) {
		const state = { inner: 0, sideEffects: 0 };
		const inner = Effect.gen(function* () {
			state.inner += 1;
			yield* order("o1");
		});
		const body = Effect.gen(function* () {
			yield* Effect.sleep("1 second");
			yield* Effect.ignore(transaction(inner));
			state.sideEffects += 1;
		});
		const { exits, run } = yield* harnessed(changes, body);
		yield* Effect.promise(() => client.$transaction(run, { timeout: 100 }).catch(() => undefined));
		expect(expiredIn(exits)).toBe(true);
		expect(state).toEqual({ inner: 0, sideEffects: 0 });
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"a transaction that cannot start before maxWait fails with PrismaError and leaves the one holding the connection running",
	[clientIsConfigured({ max: 1 })],
	function* ({ published, transaction, order, orderIds }) {
		const holding = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const holder = yield* Effect.forkChild(
			transaction(
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
		const failure = yield* Effect.flip(transaction(order("o3"), { maxWait: 1 }));
		yield* Deferred.succeed(release, undefined);
		const held = yield* Fiber.await(holder);
		expect(failure).toBeInstanceOf(PrismaError);
		expect(Exit.isSuccess(held)).toBe(true);
		expect(yield* orderIds()).toEqual(["o1", "o2"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);
