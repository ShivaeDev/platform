import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import type { BetterAuthOptions } from "better-auth";
import { Effect, FileSystem, type Scope } from "effect";
import { Migrator, type SqlClient } from "effect/sql";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import type { StoredRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { generateBetterAuthMigration } from "#server/better-auth/migrations/generate.ts";

export const authMigrationFiles = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer));
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "auth-migrations-" });
	yield* fs.writeFileString(`${directory}/package.json`, '{"type":"module"}');
	yield* fs.makeDirectory(`${directory}/node_modules`);
	yield* fs.symlink(fileURLToPath(new URL("../../../node_modules/effect", import.meta.url)), `${directory}/node_modules/effect`);
	return {
		generate: (name: string, options: Omit<BetterAuthOptions, "database">, role?: StoredRoleOptions) =>
			Effect.flatMap(generateBetterAuthMigration(options, role), (source) => fs.writeFileString(`${directory}/${name}.ts`, source)),
		migrate: (live?: Effect.Effect<unknown, unknown, SqlClient.SqlClient | Scope.Scope>) =>
			migratePostgres({
				loader: Migrator.fromFileSystem(directory).pipe(
					Effect.provide(NodeServices.layer),
					Effect.map((entries) => (live === undefined ? entries : [...entries, [3, "live_roles", Effect.succeed(live)] as const])),
				),
				lockTimeout: "2 seconds",
			}),
		referenceUsers: () =>
			fs.writeFileString(
				`${directory}/0002_references.ts`,
				`import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql\`create table notes (id text primary key, user_id text references "user" (id) on delete cascade)\`;
});`,
			),
	};
});
