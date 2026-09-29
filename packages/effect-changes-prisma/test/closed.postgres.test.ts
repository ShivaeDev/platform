import { Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { PrismaError, TransactionExpired } from "../src/index.ts";
import { makeChanges } from "./support/changes.ts";
import { connect, integration, makeDatabase, orderIds } from "./support/database.ts";
import { createOrder, expiredIn, harnessed, warm } from "./support/expiry.ts";

const closedTransaction = Object.assign(new Error("Transaction already closed"), { code: "P2028" });

integration("a separate transaction a body starts on the base client does not interrupt the body's transaction when it is closed", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const closes = Effect.andThen(
					createOrder(changes, "o2"),
					changes.use(() => Promise.reject(closedTransaction)),
				);
				const onBase = changes.transaction(closes).pipe(Effect.provideService(changes.Client, client));
				const separate = yield* changes.transaction(
					Effect.gen(function* () {
						yield* createOrder(changes, "o1");
						const failure = yield* Effect.flip(onBase);
						yield* createOrder(changes, "o3");
						return failure;
					}),
					{ timeout: 10_000 },
				);
				expect(separate).toBeInstanceOf(TransactionExpired);
				expect(yield* orderIds(observer)).toEqual(["o1", "o3"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);

integration("a query that finds the enclosing transaction expired stops the body even without a deadline of its own", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const state = { sideEffects: 0 };
				const body = Effect.gen(function* () {
					yield* Effect.sleep("1 second");
					yield* Effect.ignore(createOrder(changes, "o1"));
					state.sideEffects += 1;
				});
				const { exits, run } = yield* harnessed(changes, body);
				yield* Effect.promise(() => client.$transaction(run, { timeout: 100 }).catch(() => undefined));
				expect(expiredIn(exits)).toBe(true);
				expect(state.sideEffects).toBe(0);
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("another binding's transaction that expires inside a body leaves the body's own transaction running", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, client, observer } = yield* makeDatabase;
				const other = yield* connect(schema);
				const { changes, published } = makeChanges(client);
				const { changes: nested } = makeChanges(other);
				const expired = yield* changes.transaction(
					Effect.gen(function* () {
						yield* createOrder(changes, "o1");
						const { exits, run } = yield* harnessed(nested, Effect.andThen(Effect.sleep("1 second"), Effect.ignore(createOrder(nested, "o2"))));
						yield* Effect.promise(() => other.$transaction(run, { timeout: 100 }).catch(() => undefined));
						yield* createOrder(changes, "o3");
						return expiredIn(exits);
					}),
					{ timeout: 10_000 },
				);
				expect(expired).toBe(true);
				expect(yield* orderIds(observer)).toEqual(["o1", "o3"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);

integration("a nested transaction that finds the enclosing transaction expired fails with TransactionExpired and stops the body", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const state = { sideEffects: 0, inner: 0 };
				const inner = Effect.gen(function* () {
					state.inner += 1;
					yield* createOrder(changes, "o1");
				});
				const body = Effect.gen(function* () {
					yield* Effect.sleep("1 second");
					yield* Effect.ignore(changes.transaction(inner));
					state.sideEffects += 1;
				});
				const { exits, run } = yield* harnessed(changes, body);
				yield* Effect.promise(() => client.$transaction(run, { timeout: 100 }).catch(() => undefined));
				expect(expiredIn(exits)).toBe(true);
				expect(state).toEqual({ sideEffects: 0, inner: 0 });
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("a transaction that cannot start before maxWait fails with PrismaError and leaves the one holding the connection running", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, observer } = yield* makeDatabase;
				const client = yield* connect(schema, { max: 1 });
				yield* warm(client);
				const { changes, published } = makeChanges(client);
				const holding = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const holder = yield* Effect.forkChild(
					changes.transaction(
						Effect.gen(function* () {
							yield* createOrder(changes, "o1");
							yield* Deferred.succeed(holding, undefined);
							yield* Deferred.await(release);
							yield* createOrder(changes, "o2");
						}),
						{ timeout: 10_000 },
					),
				);
				yield* Deferred.await(holding);
				const failure = yield* Effect.flip(changes.transaction(createOrder(changes, "o3"), { maxWait: 1 }));
				yield* Deferred.succeed(release, undefined);
				const held = yield* Fiber.await(holder);
				expect(failure).toBeInstanceOf(PrismaError);
				expect(Exit.isSuccess(held)).toBe(true);
				expect(yield* orderIds(observer)).toEqual(["o1", "o2"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);
