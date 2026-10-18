import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { TransactionExpired } from "#error.ts";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { clientHasTimeout, currentClientHasTimeout, postgres } from "#test/prismaTraits.ts";
import { timed, transactionProbe } from "#test/transactionProbe.ts";

prisma.it.runIf(postgresEnabled)(
	"a transaction that reaches its timeout interrupts its body and fails with TransactionExpired",
	[postgres()],
	function* ({ database: { published, expires, orders } }) {
		const { failure, state, elapsed } = yield* expires({ timeout: 100 });
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(published).toEqual([]);
		expect(yield* orders()).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"without a timeout option the body is interrupted at the client's configured transaction timeout",
	[clientHasTimeout(100), postgres()],
	function* ({ database: { published, expires, orders } }) {
		const { failure, state, elapsed } = yield* expires();
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(published).toEqual([]);
		expect(yield* orders()).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a transaction on another root client provided as the current client, as a per-request extended client is, times out at that client's timeout",
	[currentClientHasTimeout(100), postgres()],
	function* ({ database: { published, expires, orders } }) {
		const { failure, state, elapsed } = yield* expires();
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(published).toEqual([]);
		expect(yield* orders()).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a body that finishes inside the timeout still commits and publishes",
	[postgres()],
	function* ({ database: { changes, published, order, orders } }) {
		const { state, body } = transactionProbe("300 millis");
		yield* changes.transaction(body(order("o1")), { timeout: 2000 });
		expect(state).toEqual({ interrupted: false, sideEffects: 1 });
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"the timeout follows the wall clock, so a TestClock moved past it does not expire the transaction",
	[postgres()],
	function* ({ database: { changes, published, order, orders } }) {
		yield* changes.transaction(Effect.andThen(TestClock.adjust("1 minute"), order("o1")), { timeout: 5000 }).pipe(Effect.provide(TestClock.layer()));
		expect(yield* orders()).toEqual(["o1"]);
		expect(published).toEqual([["ada:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"an outer transaction that reaches its timeout while a nested transaction runs interrupts both and publishes nothing",
	[postgres()],
	function* ({ database: { changes, published, order, orders } }) {
		const { state, body } = transactionProbe("2 seconds");
		const nested = Effect.andThen(order("o1"), changes.transaction(body(order("o2"))));
		const { result: failure, elapsed } = yield* timed(Effect.flip(changes.transaction(nested, { timeout: 200 })));
		expect(failure).toBeInstanceOf(TransactionExpired);
		expect(state).toEqual({ interrupted: true, sideEffects: 0 });
		expect(elapsed).toBeLessThan(1000);
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);
