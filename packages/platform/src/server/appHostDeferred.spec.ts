import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer, ManagedRuntime } from "effect";
import { HttpServer } from "effect/http";
import { Migrator, SqlClient } from "effect/sql";
import { expect, it } from "vitest";
import { appDatabase, appHost } from "#appHost.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";

const database = Effect.runSync(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));

it.runIf(database._tag === "Some").each(["migrate", "check"] as const)(
	"%s completes before application construction and owns its scope",
	async (mode) => {
		if (database._tag === "None") {
			throw new Error("PostgreSQL URL is required");
		}
		const table = `deferred_${crypto.randomUUID().replaceAll("-", "")}`;
		const lifecycle: string[] = [];
		const migrations = {
			loader: Migrator.fromRecord({
				"001_prepare": Effect.sync(() => lifecycle.push("migrated")),
			}),
			table,
		};
		const config = { databaseUrl: database.value };
		if (mode === "check") {
			await Effect.runPromise(Layer.build(appDatabase({ config, migrations })).pipe(Effect.scoped));
		}
		const runtime = ManagedRuntime.make(
			appHost({
				application: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					expect(yield* sql`select name from ${sql(table)}`).toEqual([{ name: "prepare" }]);
					yield* Effect.acquireRelease(
						Effect.sync(() => lifecycle.push("constructed")),
						() => Effect.sync(() => lifecycle.push("released")),
					);
					return { config: { port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback" as const };
				}),
				config,
				migrations: { ...migrations, mode },
			}),
		);
		try {
			await runtime.runPromise(HttpServer.HttpServer);
			expect(lifecycle).toEqual(["migrated", "constructed"]);
		} finally {
			await runtime.dispose();
			await Effect.runPromise(
				SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}`).pipe(Effect.provide(PgClient.layer({ url: database.value }))),
			);
		}
		expect(lifecycle).toEqual(["migrated", "constructed", "released"]);
	},
);

it.runIf(database._tag === "Some").each(["migrate", "check"] as const)("failed %s prevents application construction", async (mode) => {
	if (database._tag === "None") {
		throw new Error("PostgreSQL URL is required");
	}
	let constructed = false;
	const runtime = ManagedRuntime.make(
		appHost({
			application: Effect.sync(() => {
				constructed = true;
				return { config: { port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback" as const };
			}),
			config: { databaseUrl: database.value },
			migrations: {
				loader: Migrator.fromRecord({ "001_fail": Effect.fail(new Error("Migration failed")) }),
				mode,
				table: `deferred_failed_${crypto.randomUUID().replaceAll("-", "")}`,
			},
		}),
	);
	try {
		await expect(runtime.runPromise(HttpServer.HttpServer)).rejects.toThrow();
		expect(constructed).toBe(false);
	} finally {
		await runtime.dispose();
	}
});
