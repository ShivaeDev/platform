import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { configured, setup, values } from "#test/postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

const kit = setup();
const { effectApp } = makeEffectIt({
	around: withTestTransaction,
	clock: "live",
	layer: kit.layer,
	makeHarness: () =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			expect(yield* values).toEqual([{ value: "seed" }]);
			yield* Effect.acquireRelease(sql`insert into items values (2, 'harness')`, () => Effect.orDie(sql`insert into items values (3, 'finalizer')`));
			return { sql };
		}),
});

effectApp.skipIf(!configured)("wraps harness acquisition, body and scope finalizers in the test transaction", function* ({ sql }) {
	yield* sql`update items set value = 'body' where id = 1`;
	expect(yield* values).toEqual([{ value: "body" }, { value: "harness" }]);
});

effectApp.skipIf(!configured)("the next test starts from the fixtures without the preceding body's or finalizer's rows", function* () {
	expect(yield* values).toEqual([{ value: "seed" }, { value: "harness" }]);
	expect(kit.counts).toEqual({ fixtures: 1, migrations: 1 });
});

effectApp.skipIf(!configured)("an isolated database inside a rollback test commits outside the wrapping transaction", function* () {
	yield* withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			expect(Option.isNone(yield* Effect.serviceOption(sql.transactionService))).toBe(true);
			expect(yield* values).toEqual([{ value: "seed" }]);
			yield* sql`update items set value = 'committed'`;
		}),
	);
	expect(yield* values).toEqual([{ value: "seed" }, { value: "harness" }]);
	expect(kit.counts).toEqual({ fixtures: 1, migrations: 1 });
});
