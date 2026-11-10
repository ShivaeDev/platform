import { Context, Effect, Option, Redacted, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer, signedIn } from "#readPolicy.ts";

export const readers = collection("shelf_readers", Schema.String);
export const books = collection("shelf_books", Schema.Number, { shelf: Schema.Number });

export class Pause extends Context.Service<Pause, { readonly betweenStatements: Effect.Effect<void> }>()("@shivaedev/contract/test/ShelfPause") {}
export class Viewer extends RpcMiddleware.Service<Viewer>()("@shivaedev/contract/test/ShelfViewer") {}

export const Shelves = contract("shelves", {
	commands: [
		command("edit", {
			invalidates: ({ id }, shelf) => [books.item(id), books.bucket.shelf(shelf)],
			payload: { id: Schema.Number, title: Schema.String },
			success: Schema.Number,
		}),
		command("move", {
			invalidates: ({ reader }) => [readers.item(reader)],
			payload: { reader: Schema.String, shelf: Schema.Number },
		}),
	],
	queries: [
		query("shelf", {
			readPolicy: signedIn,
			reads: (_payload, viewer) => (Option.isSome(viewer) ? [readers.item(viewer.value.id)] : []),
			success: Schema.Array(Schema.String),
		}),
		query("catalog", { readPolicy: signedIn, reads: () => [books.list], success: Schema.Array(Schema.String) }),
	],
}).middleware(Viewer);

export const migrations = {
	loader: Migrator.fromRecord({
		"1_shelves": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table shelf_readers (name text primary key, shelf integer not null)`;
			yield* sql`create table shelf_books (id integer primary key, shelf integer not null, title text not null)`;
			yield* sql`insert into shelf_readers values ('alice', 1)`;
			yield* sql`insert into shelf_books values (1, 1, 'Dune'), (2, 1, 'Emma'), (3, 2, 'Ulysses')`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });

export const handlers = Shelves.application.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return {
			"shelves.catalog": () =>
				sql<{ title: string }>`select title from shelf_books order by id`.pipe(
					Effect.map((rows) => rows.map(({ title }) => title)),
					Effect.orDie,
				),
			"shelves.edit": ({ id, title }) =>
				sql<{ shelf: number }>`update shelf_books set title = ${title} where id = ${id} returning shelf`.pipe(
					Effect.flatMap(([row]) => (row === undefined ? Effect.die(`Missing book ${id}`) : Effect.succeed(row.shelf))),
					Effect.orDie,
				),
			"shelves.move": ({ reader, shelf }) => sql`update shelf_readers set shelf = ${shelf} where name = ${reader}`.pipe(Effect.asVoid, Effect.orDie),
			"shelves.shelf": () =>
				Effect.gen(function* () {
					const viewer = yield* CurrentViewer;
					if (Option.isNone(viewer)) {
						return [];
					}
					const [reader] = yield* sql<{ shelf: number }>`select shelf from shelf_readers where name = ${viewer.value.id}`;
					if (reader === undefined) {
						return [];
					}
					yield* recordRead([books.bucket.shelf(reader.shelf)]);
					yield* (yield* Pause).betweenStatements;
					const rows = yield* sql<{ title: string }>`select title from shelf_books where shelf = ${reader.shelf} order by id`;
					return rows.map(({ title }) => title);
				}).pipe(Effect.orDie),
		};
	}),
);
