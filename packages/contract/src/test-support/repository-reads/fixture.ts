import { Context, Effect, Option, Redacted, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer, signedIn, type Viewer } from "#readPolicy.ts";

export class Book extends Model.Class<Book>("LibraryBook")({ id: Schema.Number, shelf: bucket(Schema.Number), title: Schema.String }) {}
export class Reader extends Model.Class<Reader>("LibraryReader")({ name: Schema.String, shelf: Schema.Number }) {}
export const books = collection("library_books", Schema.Number, { shelf: Schema.Number });

export const makeBooks = makeRepository(Book, { collection: books, idColumn: "id", spanPrefix: "LibraryBooks", tableName: "library_books" });
export const makeReaders = makeRepository(Reader, { idColumn: "name", spanPrefix: "LibraryReaders", tableName: "library_readers" });

export class Library extends Context.Service<
	Library,
	{ readonly books: Effect.Success<typeof makeBooks>; readonly readers: Effect.Success<typeof makeReaders> }
>()("@shivaedev/contract/test/Library") {}
export class LibraryViewer extends RpcMiddleware.Service<LibraryViewer>()("@shivaedev/contract/test/LibraryViewer") {}

function readerOf(viewer: Option.Option<Viewer>) {
	return Option.match(viewer, { onNone: () => "", onSome: ({ id }) => id });
}

const Titles = Schema.Array(Schema.String);
const shelf = { shelf: Schema.Number };

export const Libraries = contract("library", {
	commands: [
		command("retitle", { payload: { id: Schema.Number, title: Schema.String } }),
		command("move", { payload: { reader: Schema.String, shelf: Schema.Number } }),
	],
	queries: [
		query("book", { payload: { id: Schema.Number }, readPolicy: signedIn, reads: () => [], success: Schema.String }),
		query("rereadBook", { payload: { id: Schema.Number, times: Schema.Number }, readPolicy: signedIn, reads: () => [], success: Schema.String }),
		query("shelf", { payload: shelf, readPolicy: signedIn, reads: () => [], success: Titles }),
		query("catalog", { readPolicy: signedIn, reads: () => [], success: Titles }),
		query("reader", { readPolicy: signedIn, reads: () => [], success: Schema.Number }),
		query("readerShelf", {
			payload: shelf,
			readPolicy: (_payload, viewer) =>
				Effect.flatMap(Library, ({ readers }) => Effect.map(readers.findOne({ where: { name: readerOf(viewer) } }), Option.isSome)).pipe(
					Effect.orDie,
				),
			reads: () => [],
			success: Titles,
		}),
	],
}).middleware(LibraryViewer);

export const migrations = {
	loader: Migrator.fromRecord({
		"1_library": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table library_readers (name text primary key, shelf integer not null)`;
			yield* sql`create table library_books (id integer primary key, shelf integer not null, title text not null)`;
			yield* sql`insert into library_readers values ('alice', 1)`;
			yield* sql`insert into library_books values (1, 1, 'Dune'), (2, 1, 'Emma'), (3, 2, 'Ulysses')`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") });

const byId = { orderBy: { direction: "asc", field: "id" } } as const;

export const handlers = Libraries.application.toLayer(
	Effect.gen(function* () {
		const { books: bookRows, readers } = yield* Library;
		function shelfTitles({ shelf: pinned }: { readonly shelf: number }) {
			return bookRows.findMany({ ...byId, where: { shelf: pinned } }).pipe(
				Effect.map((rows) => rows.map(({ title }) => title)),
				Effect.orDie,
			);
		}
		return {
			"library.book": ({ id }) => Effect.map(bookRows.findById(id), ({ title }) => title).pipe(Effect.orDie),
			"library.catalog": () =>
				bookRows.findMany(byId).pipe(
					Effect.map((rows) => rows.map(({ title }) => title)),
					Effect.orDie,
				),
			"library.move": ({ reader, shelf: next }) => readers.updateVoid({ name: reader, shelf: next }).pipe(Effect.orDie),
			"library.reader": () =>
				Effect.flatMap(CurrentViewer, (viewer) => Effect.map(readers.findById(readerOf(viewer)), (reader) => reader.shelf)).pipe(Effect.orDie),
			"library.readerShelf": shelfTitles,
			"library.rereadBook": ({ id, times }) =>
				Effect.forEach(Array.from({ length: times }), () => bookRows.findById(id)).pipe(
					Effect.map((reads) => reads.at(-1)?.title ?? ""),
					Effect.orDie,
				),
			"library.retitle": ({ id, title }) => bookRows.updateVoid({ id, title }, { columns: ["title"] }).pipe(Effect.orDie),
			"library.shelf": shelfTitles,
		};
	}),
);
