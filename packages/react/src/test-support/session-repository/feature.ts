import { Context, Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

class Note extends Model.Class<Note>("SessionRepositoryNote")({ id: Schema.Number, owner: bucket(Schema.String), title: Schema.String }) {}
const notes = collection("session_notes", Schema.Number, { owner: Schema.String });
export class ReadAccess extends Context.Service<ReadAccess, { readonly allowed: Set<string> }>()(
	"@shivaedev/react/test/SessionRepositoryReadAccess",
) {}

function get<const TName extends string>(name: TName) {
	return query(name, {
		payload: { id: Schema.Number },
		readPolicy: (_input, viewer) => Effect.map(ReadAccess, ({ allowed }) => Option.exists(viewer, ({ id }) => allowed.has(id))),
		reads: ({ id }) => [notes.item(id)],
		success: Schema.String,
	});
}
export const Api = contract("sessionNotes", { keyScope: "session", queries: [get("get"), get("compared")] }).middleware(Authenticated);
export const repository = makeRepository(Note, { collection: notes, idColumn: "id", spanPrefix: "SessionNotes", tableName: notes.name });
export const migrations = {
	loader: Migrator.fromRecord({
		"1_session_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table session_notes (id integer primary key, owner text not null, title text not null)`;
			yield* sql`insert into session_notes values (1, 'alice', 'First')`;
		}),
	}),
};
