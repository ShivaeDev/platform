import { Effect, Schedule } from "effect";
import { Client } from "pg";
import { makeDatabase } from "#database.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { databaseUrl } from "#test/postgres-database.ts";

export function postgresPoolLifetime(fail: boolean) {
	return Effect.acquireUseRelease(
		Effect.promise(async () => {
			const observer = new Client({ connectionString: databaseUrl });
			await observer.connect();
			return observer;
		}),
		(observer) =>
			Effect.gen(function* () {
				const name = `pool-lifetime-${crypto.randomUUID()}`;
				const url = new URL(databaseUrl ?? "postgresql://integration-tests-disabled");
				url.searchParams.set("application_name", name);
				const Database = makeDatabase<Contract>()("@test/PoolLifetimeDatabase", { contractJson });
				const connections = Effect.promise(async () => {
					const result = await observer.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1", [
						name,
					]);
					return result.rows[0]?.count;
				});
				let during: number | undefined;
				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const db = yield* Database;
						yield* db.User.count();
						during = yield* connections;
						if (fail) {
							return yield* Effect.fail("database caller failed");
						}
					}).pipe(Effect.provide(Database.layer({ url: url.toString() }))),
				);

				// PostgreSQL removes the backend asynchronously after the pool closes its socket.
				const after = yield* connections.pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), times: 100, until: (count) => count === 0 }));
				return { after, during, exit };
			}),
		(observer) => Effect.promise(() => observer.end()),
	);
}
