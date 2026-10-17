import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { TransactionExpired } from "#error.ts";
import { timed } from "#test/expiry.ts";
import { prisma } from "#test/prisma.ts";
import { bodyWaits, clientIsConfigured, transactionHasOptions } from "#test/prismaTraits.ts";

prisma.it(
	"a transaction that reaches its timeout interrupts its body and fails with TransactionExpired",
	[transactionHasOptions({ timeout: 100 })],
	function* ({ expires, probe, published, orderIds }) {
		const { result, elapsed } = yield* expires();
		expect(result).toBeInstanceOf(TransactionExpired);
		expect(probe.state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"without a timeout option the body is interrupted at the client's configured transaction timeout",
	[clientIsConfigured({ timeout: 100 })],
	function* ({ expires, probe, published, orderIds }) {
		const { result, elapsed } = yield* expires();
		expect(result).toBeInstanceOf(TransactionExpired);
		expect(probe.state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"a transaction on another root client provided as the current client times out at that client's timeout",
	[],
	function* ({ anotherBinding, expires, probe, published, orderIds }) {
		const configured = yield* anotherBinding({ timeout: 100 });
		const { result, elapsed } = yield* expires(configured.client);
		expect(result).toBeInstanceOf(TransactionExpired);
		expect(probe.state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"a body that finishes inside the timeout still commits and publishes",
	[bodyWaits("300 millis"), transactionHasOptions({ timeout: 2000 })],
	function* ({ transaction, order, probe, published, orderIds }) {
		yield* transaction(probe.body(order("o1")));
		expect(probe.state).toEqual({ interrupted: false, sideEffects: 1 });
		expect(yield* orderIds()).toEqual(["o1"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);

prisma.it(
	"the timeout follows the wall clock, so a TestClock moved past it does not expire the transaction",
	[transactionHasOptions({ timeout: 5000 })],
	function* ({ transaction, order, published, orderIds }) {
		yield* transaction(Effect.andThen(TestClock.adjust("1 minute"), order("o1"))).pipe(Effect.provide(TestClock.layer()));
		expect(yield* orderIds()).toEqual(["o1"]);
		expect(published()).toEqual([["ada:orders"]]);
	},
);

prisma.it(
	"an outer transaction that reaches its timeout while a nested transaction runs interrupts both and publishes nothing",
	[transactionHasOptions({ timeout: 200 })],
	function* ({ transaction, order, probe, published, orderIds }) {
		const nested = Effect.andThen(order("o1"), transaction(probe.body(order("o2"))));
		const { result, elapsed } = yield* timed(Effect.flip(transaction(nested)));
		expect(result).toBeInstanceOf(TransactionExpired);
		expect(probe.state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);
