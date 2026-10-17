import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

export function idleVerbs(engine: DatabaseEngine) {
	function connections(name: string) {
		return engine.admin<{ total: number }>`select count(*)::int as total from pg_stat_activity
		where application_name = ${engine.marker} and datname = ${name}`.pipe(Effect.map(([row]) => row?.total));
	}
	return {
		idleConnectionsAndDatabasesAreReleased: () =>
			Effect.gen(function* () {
				const shared = yield* engine.sharedName;
				yield* engine.run(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql`select 1`;
						yield* TestClock.adjust("61 seconds");
					}),
				);
				yield* Effect.gen(function* () {
					while ((yield* connections(shared)) !== 0) {
						yield* Effect.sleep("10 millis");
					}
				}).pipe(Effect.timeout("5 seconds"));
				const adminName = new URL(Redacted.value(engine.options.url)).pathname.slice(1);
				const idleAdminConnections = yield* connections(adminName);
				let isolated = "";
				yield* engine.run(
					withIsolatedDatabase(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							const [row] = yield* sql<{ name: string }>`select current_database() as name`;
							isolated = row?.name ?? "";
						}),
					),
				);
				yield* engine.close();
				expect(idleAdminConnections).toBe(0);
				expect(yield* connections(adminName)).toBe(0);
				expect([engine.template, shared, isolated].every((name) => name !== "")).toBe(true);
				for (const name of [engine.template, shared, isolated]) {
					expect(yield* engine.admin`select datname from pg_database where datname = ${name}`).toEqual([]);
				}
			}),
	};
}
