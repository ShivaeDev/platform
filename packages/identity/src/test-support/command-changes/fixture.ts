import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { RequestTracing } from "#middleware.ts";

export const notes = collection("command_notes", Schema.Number);
const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });
export const Api = contract("notes", {
	commands: [command("save", { invalidates: (_input, result) => [notes.item(result.id)], payload: { title: Schema.String }, success: Note })],
	queries: [query("list", { reads: () => [notes.list], success: Schema.Array(Note) })],
}).middleware(RequestTracing).application;

export const handlers = Api.toLayer({
	"notes.list": () =>
		Effect.flatMap(SqlClient.SqlClient, (sql) => sql<typeof Note.Type>`select id, title from command_notes order by id`).pipe(Effect.orDie),
	"notes.save": ({ title }) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ id: number }>`insert into command_notes (title) values (${title}) returning id`.pipe(
				transact({ onSqlError: (error) => error }),
				Effect.orDie,
			);
			const row = rows[0];
			if (row === undefined) {
				return yield* Effect.die("The inserted note returned no id");
			}
			return { id: row.id, title };
		}),
});
