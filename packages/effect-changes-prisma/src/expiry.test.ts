import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { TransactionExpired } from "#error.ts";
import type { TransactionOptions } from "#model.ts";
import { makeChanges } from "#test/changes.ts";
import { connect, integration, makeDatabase, orderIds } from "#test/database.ts";
import { createOrder, probe, timed, warm } from "#test/expiry.ts";
import type { PrismaClient } from "#test/generated/client.ts";

const expires = (client: PrismaClient, options?: TransactionOptions, current: PrismaClient = client) =>
	Effect.gen(function* () {
		yield* warm(client);
		const { changes, published } = makeChanges(client);
		const { state, body } = probe("2 seconds");
		const { result: failure, elapsed } = yield* timed(
			Effect.flip(changes.transaction(body(createOrder(changes, "o1")), options).pipe(Effect.provideService(changes.Client, current))),
		);
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(published).toEqual([]);
	});

integration("a transaction that reaches its timeout interrupts its body and fails with TransactionExpired", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				yield* expires(client, { timeout: 100 });
				expect(yield* orderIds(observer)).toEqual([]);
			}),
		),
	),
);

integration("without a timeout option the body is interrupted at the client's configured transaction timeout", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { schema, observer } = yield* makeDatabase;
				yield* expires(yield* connect(schema, { timeout: 100 }));
				expect(yield* orderIds(observer)).toEqual([]);
			}),
		),
	),
);

integration(
	"a transaction on another root client provided as the current client, as a per-request extended client is, times out at that client's timeout",
	() =>
		Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const { schema, observer } = yield* makeDatabase;
					const base = yield* connect(schema);
					const configured = yield* connect(schema, { timeout: 100 });
					yield* expires(base, undefined, configured);
					expect(yield* orderIds(observer)).toEqual([]);
				}),
			),
		),
);

integration("a body that finishes inside the timeout still commits and publishes", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				yield* warm(client);
				const { changes, published } = makeChanges(client);
				const { state, body } = probe("300 millis");
				yield* changes.transaction(body(createOrder(changes, "o1")), { timeout: 2000 });
				expect(state).toEqual({ interrupted: false, sideEffects: 1 });
				expect(yield* orderIds(observer)).toEqual(["o1"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);

integration("the timeout follows the wall clock, so a TestClock moved past it does not expire the transaction", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				yield* warm(client);
				const { changes, published } = makeChanges(client);
				yield* changes
					.transaction(Effect.andThen(TestClock.adjust("1 minute"), createOrder(changes, "o1")), { timeout: 5000 })
					.pipe(Effect.provide(TestClock.layer()));
				expect(yield* orderIds(observer)).toEqual(["o1"]);
				expect(published).toEqual([["ada:orders"]]);
			}),
		),
	),
);

integration("an outer transaction that reaches its timeout while a nested transaction runs interrupts both and publishes nothing", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				yield* warm(client);
				const { changes, published } = makeChanges(client);
				const { state, body } = probe("2 seconds");
				const nested = Effect.andThen(createOrder(changes, "o1"), changes.transaction(body(createOrder(changes, "o2"))));
				const { result: failure, elapsed } = yield* timed(Effect.flip(changes.transaction(nested, { timeout: 200 })));
				expect(failure).toBeInstanceOf(TransactionExpired);
				expect(state).toEqual({ interrupted: true, sideEffects: 0 });
				expect(elapsed).toBeLessThan(1000);
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);
