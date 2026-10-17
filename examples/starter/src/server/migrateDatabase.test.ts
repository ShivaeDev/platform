import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Redacted } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migration } from "#test-support/migration.ts";
import { migrateDatabase } from "./migrateDatabase.ts";

migration.it("applies deployment migrations without starting HTTP and safely runs again", [], function* () {
	const database = yield* PostgresTestDatabase;
	const environment = {
		"BETTER_AUTH_SECRET": "migration-test-secret-with-at-least-32-characters",
		"DATABASE_URL": Redacted.value(database.url),
	};
	const code = yield* Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
		spawner.exitCode(
			ChildProcess.make(process.execPath, [fileURLToPath(new URL("./migrate.ts", import.meta.url))], { env: environment, extendEnv: true }),
		),
	).pipe(Effect.provide(NodeServices.layer));
	expect(code).toBe(0);
	const migrate = migrateDatabase.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: environment }))));
	expect(yield* migrate).toEqual([]);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select count(*)::integer as count from app_migrations`).toEqual([{ count: 5 }]);
	expect(yield* sql`select title, "ownerId", "wordCount", version from notes`).toEqual([]);
	expect(yield* sql`select count(*)::integer as count from "user"`).toEqual([{ count: 0 }]);
});
