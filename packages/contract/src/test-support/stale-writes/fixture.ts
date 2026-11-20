import { Context, Effect, Redacted, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { Conflict, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";

const version = Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number });
class StoredNote extends Model.Class<StoredNote>("StaleNote")({ id: Schema.Number, title: Schema.String, version }) {}

export const makeNotes = makeRepository(StoredNote, { spanPrefix: "StaleNotes", tableName: "stale_notes", versionColumn: "version" });

export class StaleNotes extends Context.Service<StaleNotes, Effect.Success<typeof makeNotes>>()("@shivaedev/contract/test/StaleNotes") {}

// Lets a stale write reach the framework, which answers it.
const Rename = command("rename", {
	payload: { id: Schema.Number, title: Schema.String, version: Schema.Number },
	*run(note) {
		const notes = yield* StaleNotes;
		return (yield* notes.update(note)).version;
	},
});

// Answers a stale write itself: a note that is gone is not found.
const Remove = command("remove", {
	payload: { id: Schema.Number, version: Schema.Number },
	*run({ id, version: read }) {
		const notes = yield* StaleNotes;
		yield* notes.delete(id, read).pipe(Effect.catchTag("OptimisticConcurrencyError", () => new NotFound({ message: "That note is already gone" })));
	},
});

export const Notes = defineModule({
	name: "staleNotes",
	operations: [Rename, Remove],
	wire: {
		remove: { rejections: { NotFound }, success: Schema.Void },
		rename: { rejections: { Conflict }, success: Schema.Number },
	},
});

export const migrations = {
	loader: Migrator.fromRecord({
		"1_stale_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table stale_notes (id integer primary key, title text not null, version integer not null)`;
			yield* sql`insert into stale_notes values (1, 'Groceries', 0)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });
