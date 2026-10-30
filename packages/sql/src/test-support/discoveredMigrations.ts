import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { MIGRATIONS_DIRECTORY } from "#migrationConvention.ts";
import { migratePostgres } from "#migrations.ts";
import { migrationsFromDirectory } from "#migrationsFromDirectory.ts";
import { onPostgres } from "./engines.ts";
import type { Applied } from "./migrationEngine.ts";
import { outcomeOf } from "./outcome.ts";

interface FolderEngine {
	readonly directory: string;
	readonly fs: FileSystem.FileSystem;
	readonly root: string;
	readonly runs: Array<Applied | string>;
	readonly schema: string;
	readonly sql: SqlClient.SqlClient;
}

function writeMigration({ directory, fs, schema }: FolderEngine, name: string, statement: string) {
	return fs.writeFileString(
		`${directory}/${name}`,
		`import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export default Effect.gen(function* () {
 const sql = yield* SqlClient.SqlClient;
 yield* sql.unsafe(${JSON.stringify(statement.replaceAll("folder_labels", `${schema}.folder_labels`))});
});\n`,
	);
}

function migrateFolder({ root, schema }: FolderEngine) {
	return migratePostgres({
		loader: migrationsFromDirectory(root).pipe(Effect.provide(NodeServices.layer)),
		lockTimeout: "5 seconds",
		table: `${schema}_migrations`,
	});
}

export const discoveredMigrations = storyKit({
	...onPostgres,
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
		const engine: FolderEngine = { directory, fs, root, runs: [], schema, sql };
		return engine;
	},
	name: "discovered PostgreSQL migrations",
	stages: ["folder"],
	verbs: (engine, story) => ({
		addMigration: (name: string, statement: string) => {
			story.tell(`${name} is added to the migrations folder`);
			return writeMigration(engine, name, statement);
		},
		labels: () =>
			Effect.map(engine.sql<{ readonly label: string }>`select label from ${engine.sql(`${engine.schema}.folder_labels`)} order by label`, (rows) =>
				rows.map(({ label }) => label),
			).pipe(Effect.orDie),
		migrate: () =>
			Effect.gen(function* () {
				story.tell("a runner migrates the files discovered in the app's migrations folder");
				const exit = yield* Effect.exit(migrateFolder(engine));
				engine.runs.push(Exit.isSuccess(exit) ? exit.value : outcomeOf(exit));
			}),
		runs: () => Effect.sync(() => [...engine.runs]),
	}),
});

export function folderApplied(name: string, statement: string) {
	return discoveredMigrations.trait("folder", `an earlier run applied ${name} from the migrations folder`, (engine) =>
		Effect.andThen(writeMigration(engine, name, statement), migrateFolder(engine)),
	);
}
