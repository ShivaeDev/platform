import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";

export const notes = collection("command_notes", Schema.Number);
export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });
export const Api = contract("notes", {
	commands: [
		command("save", { invalidates: (_input, result) => [notes.item(result.id)], payload: { title: Schema.String }, success: Note }),
		command("announce", { invalidates: (_input, result) => [notes.item(result.id)], payload: { title: Schema.String }, success: Note }),
		command("reject", {
			invalidates: (_input, result) => [notes.item(result.id)],
			payload: { title: Schema.String },
			rejections: { Conflict },
			success: Note,
		}),
	],
	queries: [query("list", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.Array(Note) })],
}).application;

export const saveNote = Effect.fnUntraced(function* ({
	title,
	announce,
	reject,
}: {
	readonly title: string;
	readonly announce?: boolean;
	readonly reject?: boolean;
}) {
	const sql = yield* SqlClient.SqlClient;
	return yield* Effect.gen(function* () {
		const rows = yield* sql<{ id: number }>`insert into command_notes (title) values (${title}) returning id`;
		const row = rows[0];
		if (row === undefined) {
			return yield* Effect.die("The inserted note returned no id");
		}
		if (announce || reject) {
			yield* invalidateOnCommit(invalidationKeys([notes.item(row.id)]));
		}
		if (reject) {
			return yield* new Conflict({ message: "Note rejected" });
		}
		return { id: row.id, title };
	}).pipe(transact({ onSqlError: (error) => error }), Effect.catchTag("SqlError", Effect.die));
});

export const handlers = Api.toLayer({
	"notes.announce": (input) => saveNote({ ...input, announce: true }).pipe(Effect.catchTag("Conflict", Effect.die)),
	"notes.list": () =>
		Effect.flatMap(SqlClient.SqlClient, (sql) => sql<typeof Note.Type>`select id, title from command_notes order by id`).pipe(Effect.orDie),
	"notes.reject": (input) => saveNote({ ...input, reject: true }),
	"notes.save": (input) => saveNote(input).pipe(Effect.catchTag("Conflict", Effect.die)),
});
