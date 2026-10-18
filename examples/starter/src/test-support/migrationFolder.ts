import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/sql";
import { MIGRATIONS_DIRECTORY } from "@shivaedev/effect-sql/migrationConvention.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { migrationsFromDirectory } from "@shivaedev/effect-sql/migrationsFromDirectory.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { postgres } from "./postgres.ts";

export const migrationFolder = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer));
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "migration-folder-" });
		const directory = `${root}/${MIGRATIONS_DIRECTORY}`;
		yield* fs.makeDirectory(directory, { recursive: true });
		yield* fs.writeFileString(`${root}/package.json`, '{"type":"module"}');
		yield* fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), `${root}/node_modules`);
		return { directory, fs, root };
	},
	layer: postgres,
	name: "discovered PostgreSQL migrations",
	stages: [],
	verbs: ({ root, directory, fs }, story) => ({
		addMigration: (name: string, statement: string) => {
			story.tell(`add ${name} to the migrations folder`);
			return fs.writeFileString(
				`${directory}/${name}`,
				`import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export default Effect.gen(function* () {
 const sql = yield* SqlClient.SqlClient;
 yield* sql.unsafe(${JSON.stringify(statement)});
});\n`,
			);
		},
		migrate: () => {
			story.tell("run migrations discovered in the app folder");
			return migratePostgres({
				loader: migrationsFromDirectory(root).pipe(Effect.provide(NodeServices.layer)),
				lockTimeout: "5 seconds",
				table: "folder_migrations",
			});
		},
		storedLabels: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select label from folder_labels order by label`;
		}),
	}),
});
