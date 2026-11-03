import { Effect, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { transact } from "@shivaedev/sql/transact.ts";

const notes = collection("recovery_notes", Schema.String);
export const Api = contract("recovery", {
	commands: [
		command("save", {
			invalidates: ({ key }) => [notes.item(key)],
			payload: { key: Schema.String, title: Schema.String },
			success: Schema.Struct({ title: Schema.String }),
		}),
	],
	queries: [
		query("list", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [notes.list],
			success: Schema.Array(Schema.String),
		}),
	],
});
export const migrations = {
	loader: Migrator.fromRecord({
		"001_notes": SqlClient.SqlClient.use((sql) => sql`create table recovery_notes (title text not null)`),
	}),
};
export const handlers = Api.application.toLayer({
	"recovery.list": () =>
		SqlClient.SqlClient.use((sql) => sql<{ title: string }>`select title from recovery_notes order by title`).pipe(
			Effect.map((rows) => rows.map(({ title }) => title)),
			Effect.orDie,
		),
	"recovery.save": ({ title }) =>
		SqlClient.SqlClient.use((sql) => sql`insert into recovery_notes values (${title})`).pipe(
			transact({ onSqlError: (error) => error }),
			Effect.as({ title }),
			Effect.orDie,
		),
});
