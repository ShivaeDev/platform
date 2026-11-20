import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loadMigrationsIn } from "#loadMigrationsIn.ts";
import { MIGRATIONS_FOLDER } from "#migration.ts";
import { migratePostgres } from "#migrations.ts";
import { onPostgres } from "#test/engines.ts";
import type { Applied } from "#test/migrationEngine.ts";
import { outcomeOf } from "#test/outcome.ts";

interface FolderEngine {
	readonly directory: string;
	readonly folder: string;
	readonly fs: FileSystem.FileSystem;
	readonly runs: Array<Applied | string>;
	readonly schema: string;
	readonly sql: SqlClient.SqlClient;
}

function writeMigration({ folder, fs, schema }: FolderEngine, name: string, statement: string) {
	return fs.writeFileString(
		`${folder}/${name}`,
		`import { Effect } from "effect";
import { SqlClient } from "effect/sql";
export default Effect.gen(function* () {
 const sql = yield* SqlClient.SqlClient;
 yield* sql.unsafe(${JSON.stringify(statement.replaceAll("folder_labels", `${schema}.folder_labels`))});
});\n`,
	);
}

function migrateFolder({ directory, schema }: FolderEngine) {
	return migratePostgres({
		loader: loadMigrationsIn(directory).pipe(Effect.provide(NodeServices.layer)),
		lockTimeout: "5 seconds",
		table: `${schema}_migrations`,
	});
}

export const discoveredMigrations = storyKit({
	...onPostgres,
	*create() {
		const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer));
		const directory = yield* fs.makeTempDirectoryScoped({ prefix: "migration-folder-" });
		const folder = `${directory}/${MIGRATIONS_FOLDER}`;
		yield* fs.makeDirectory(folder);
		yield* fs.writeFileString(`${directory}/package.json`, '{"type":"module"}');
		yield* fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), `${directory}/node_modules`);
		const sql = yield* SqlClient.SqlClient;
		const schema = `folder_${crypto.randomUUID().replaceAll("-", "")}`;
		yield* sql`create schema ${sql(schema)}`;
		yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(`${schema}_migrations`)}`.pipe(Effect.orDie));
		yield* Effect.addFinalizer(() => sql`drop schema ${sql(schema)} cascade`.pipe(Effect.orDie));
		const engine: FolderEngine = { directory, folder, fs, runs: [], schema, sql };
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
				story.tell("a runner migrates the files discovered in the directory's migrations folder");
				const exit = yield* Effect.exit(migrateFolder(engine));
				engine.runs.push(Exit.isSuccess(exit) ? exit.value : outcomeOf(exit).replaceAll(engine.directory, "<directory>"));
			}),
		runs: () => Effect.sync(() => [...engine.runs]),
	}),
});

export function folderApplied(name: string, statement: string) {
	return discoveredMigrations.trait("folder", `an earlier run applied ${name} from the migrations folder`, (engine) =>
		Effect.andThen(writeMigration(engine, name, statement), migrateFolder(engine)),
	);
}

export const folderMissing = discoveredMigrations.trait("folder", "the directory has no migrations folder", ({ folder, fs }) =>
	fs.remove(folder, { recursive: true }).pipe(Effect.orDie),
);
