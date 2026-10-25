import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { MIGRATIONS_DIRECTORY } from "#migrationConvention.ts";
import { migratePostgres } from "#migrations.ts";
import { migrationsFromDirectory } from "#migrationsFromDirectory.ts";
import { configured, postgresLayer } from "#test/postgres.ts";

export const migrationFolder = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer));
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "migration-folder-" });
		const directory = `${root}/${MIGRATIONS_DIRECTORY}`;
		yield* fs.makeDirectory(directory, { recursive: true });
		yield* fs.writeFileString(`${root}/package.json`, '{"type":"module"}');
		yield* fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), `${root}/node_modules`);
		const sql = yield* SqlClient.SqlClient;
		const schema = `folder_${crypto.randomUUID().replaceAll("-", "")}`;
		yield* sql`create schema ${sql(schema)}`;
		yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(`${schema}_migrations`)}`.pipe(Effect.orDie));
		yield* Effect.addFinalizer(() => sql`drop schema ${sql(schema)} cascade`.pipe(Effect.orDie));
		return { directory, fs, root, schema };
	},
	layer: postgresLayer,
	name: "discovered PostgreSQL migrations",
	runIf: configured,
	stages: [],
	verbs: ({ root, directory, fs, schema }, story) => ({
		addMigration: (name: string, statement: string) => {
			story.tell(`add ${name} to the migrations folder`);
			return fs.writeFileString(
				`${directory}/${name}`,
				`import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export default Effect.gen(function* () {
 const sql = yield* SqlClient.SqlClient;
 yield* sql.unsafe(${JSON.stringify(statement.replaceAll("folder_labels", `${schema}.folder_labels`))});
});\n`,
			);
		},
		migrate: () => {
			story.tell("run migrations discovered in the app folder");
			return migratePostgres({
				loader: migrationsFromDirectory(root).pipe(Effect.provide(NodeServices.layer)),
				lockTimeout: "5 seconds",
				table: `${schema}_migrations`,
			});
		},
		storedLabels: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select label from ${sql(`${schema}.folder_labels`)} order by label`;
		}),
	}),
});
