import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

export class Note extends Model.Class<Note>("AutomaticNote")({ id: Schema.Number, title: Schema.String }) {}
export const notes = collection("notes", Schema.Number);
export const summary = collection("summary", Schema.Number);
export const Get = query("get", {
	payload: { id: Schema.Number },
	readPolicy: () => Effect.succeed(true),
	reads: ({ id }) => [notes.item(id)],
	success: Note.json,
});
export const Rename = command("rename", {
	invalidates: ({ id }) => [notes.item(id), summary.list],
	payload: Note.fields,
	success: Note.json,
});
export const Api = contract("notes", { commands: [Rename], queries: [Get] });
export const repository = makeRepository(Note, { idColumn: "id", spanPrefix: "Notes", tableName: "notes" });
export const migrations = {
	loader: Migrator.fromRecord({
		"1_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table notes (id integer primary key, title text not null)`;
			yield* sql`insert into notes values (1, 'First'), (2, 'Second')`;
		}),
	}),
};
