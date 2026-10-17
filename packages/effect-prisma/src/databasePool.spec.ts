import { Effect, Exit } from "effect";
import { Client } from "pg";
import { expect } from "vitest";
import { makeDatabase } from "#database.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { environmentVariable } from "#test/environment.ts";
import { integrationEffect } from "#test/postgres-database.ts";

const assertPoolLifetime = Effect.fnUntraced(function* (observer: Client, fail: boolean) {
	const name = `pool-lifetime-${crypto.randomUUID()}`;
	const url = new URL(environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled");
	url.searchParams.set("application_name", name);
	const Database = makeDatabase<Contract>()("@test/PoolLifetimeDatabase", { contractJson });
	const connections = Effect.promise(async () => {
		const result = await observer.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1", [name]);
		return result.rows[0]?.count;
	});
	const exit = yield* Effect.exit(
		Effect.gen(function* () {
			const db = yield* Database;
			yield* db.User.count();
			expect(yield* connections).toBe(1);
			if (fail) {
				return yield* Effect.fail("database caller failed");
			}
		}).pipe(Effect.provide(Database.layer({ url: url.toString() }))),
	);
	expect(exit).toEqual(fail ? Exit.fail("database caller failed") : Exit.succeed(undefined));
	expect(yield* connections).toBe(0);
});

for (const fail of [false, true]) {
	integrationEffect(`closes the owned PostgreSQL pool after ${fail ? "failure" : "success"}`, () =>
		Effect.acquireUseRelease(
			Effect.promise(async () => {
				const observer = new Client({ connectionString: environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") });
				await observer.connect();
				return observer;
			}),
			(observer) => assertPoolLifetime(observer, fail),
			(observer) => Effect.promise(() => observer.end()),
		),
	);
}
