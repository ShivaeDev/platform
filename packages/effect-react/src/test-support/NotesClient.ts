import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer, Schema } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";

class Note extends Model.Class<Note>("Note")({
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	title: Schema.String,
}) {}

const Notes = RpcGroup.make(
	Rpc.make("ListNotes", { error: Schema.String, success: Schema.Array(Note) }),
	Rpc.make("CreateNote", {
		error: Schema.String,
		payload: { title: Schema.String },
		success: Note,
	}),
);

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (id integer primary key, title text not null)`;
		const notes = yield* makeRepository(Note, {
			idColumn: "id",
			spanPrefix: "Notes",
			tableName: "notes",
		});
		function createNote({ title }: { readonly title: string }) {
			return title.trim() === "" ? Effect.fail("title required") : notes.insert({ title }).pipe(Effect.mapError(() => "storage unavailable"));
		}
		function listNotes() {
			return notes.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(Effect.mapError(() => "storage unavailable"));
		}
		return Notes.of({ CreateNote: createNote, ListNotes: listNotes });
	}),
).pipe(Layer.provide(SqliteClient.layer({ filename: ":memory:" })));

export class NotesClient extends AtomRpc.Service<NotesClient>()("test/NotesClient", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: handlers,
}) {}
