import { Context, Effect, Option, Redacted, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { defineModule } from "#defineModule.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer, signedIn, type Viewer } from "#readPolicy.ts";

export class StoredBook extends Model.Class<StoredBook>("LibraryBook")({ id: Schema.Number, shelf: bucket(Schema.Number), title: Schema.String }) {}
export class StoredReader extends Model.Class<StoredReader>("LibraryReader")({ name: Schema.String, shelf: Schema.Number }) {}
export const books = collection("library_books", Schema.Number, { shelf: Schema.Number });

export const makeBooks = makeRepository(StoredBook, { collection: books, idColumn: "id", spanPrefix: "LibraryBooks", tableName: "library_books" });
export const makeReaders = makeRepository(StoredReader, { idColumn: "name", spanPrefix: "LibraryReaders", tableName: "library_readers" });

export class Library extends Context.Service<
	Library,
	{ readonly books: Effect.Success<typeof makeBooks>; readonly readers: Effect.Success<typeof makeReaders> }
>()("@shivaedev/contract/test/Library") {}
export class LibraryViewer extends RpcMiddleware.Service<LibraryViewer>()("@shivaedev/contract/test/LibraryViewer") {}

function readerOf(viewer: Option.Option<Viewer>) {
	return Option.match(viewer, { onNone: () => "", onSome: ({ id }) => id });
}

const Titles = Schema.mutable(Schema.Array(Schema.String));
const byId = { orderBy: { direction: "asc", field: "id" } } as const;

const titlesOn = Effect.fnUntraced(function* (shelf: number) {
	const { books: rows } = yield* Library;
	const found = yield* Effect.orDie(rows.findMany({ ...byId, where: { shelf } }));
	return found.map(({ title }) => title);
});

const Book = query("book", {
	payload: { id: Schema.Number },
	readPolicy: signedIn,
	*run({ id }) {
		const { books: rows } = yield* Library;
		return (yield* Effect.orDie(rows.findById(id))).title;
	},
	success: Schema.String,
});
const RereadBook = query("rereadBook", {
	payload: { id: Schema.Number, times: Schema.Number },
	readPolicy: signedIn,
	*run({ id, times }) {
		const { books: rows } = yield* Library;
		const reads = yield* Effect.orDie(Effect.forEach(Array.from({ length: times }), () => rows.findById(id)));
		return reads.at(-1)?.title ?? "";
	},
	success: Schema.String,
});
const Shelf = query("shelf", {
	payload: { shelf: Schema.Number },
	readPolicy: signedIn,
	*run({ shelf }) {
		return yield* titlesOn(shelf);
	},
	success: Titles,
});
const DeclaredShelf = query("declaredShelf", {
	payload: { shelf: Schema.Number },
	readPolicy: signedIn,
	reads: ({ shelf }) => [books.bucket.shelf(shelf)],
	*run({ shelf }) {
		const { books: rows } = yield* Library;
		const all = yield* Effect.orDie(rows.findMany(byId));
		return all.filter((book) => book.shelf === shelf).map(({ title }) => title);
	},
	success: Titles,
});
const Catalog = query("catalog", {
	readPolicy: signedIn,
	*run() {
		const { books: rows } = yield* Library;
		return (yield* Effect.orDie(rows.findMany(byId))).map(({ title }) => title);
	},
	success: Titles,
});
const Reader = query("reader", {
	readPolicy: signedIn,
	*run() {
		const { readers } = yield* Library;
		return (yield* Effect.orDie(readers.findById(readerOf(yield* CurrentViewer)))).shelf;
	},
	success: Schema.Number,
});
const ReaderShelf = query("readerShelf", {
	payload: { shelf: Schema.Number },
	readPolicy: (_payload, viewer) =>
		Effect.flatMap(Library, ({ readers }) => Effect.map(readers.findOne({ where: { name: readerOf(viewer) } }), Option.isSome)).pipe(Effect.orDie),
	*run({ shelf }) {
		return yield* titlesOn(shelf);
	},
	success: Titles,
});
const Retitle = command("retitle", {
	payload: { id: Schema.Number, title: Schema.String },
	*run({ id, title }) {
		const { books: rows } = yield* Library;
		yield* Effect.orDie(rows.updateVoid({ id, title }, { columns: ["title"] }));
	},
});
const Move = command("move", {
	payload: { reader: Schema.String, shelf: Schema.Number },
	*run({ reader, shelf }) {
		const { readers } = yield* Library;
		yield* Effect.orDie(readers.updateVoid({ name: reader, shelf }));
	},
});

export const Libraries = defineModule({
	middleware: LibraryViewer,
	name: "library",
	operations: [Book, RereadBook, Shelf, DeclaredShelf, Catalog, Reader, ReaderShelf, Retitle, Move],
	requires: [Library],
});

export const handlers = {
	"hand-written handlers": Libraries.application.toLayer({
		"library.book": Book.run,
		"library.catalog": Catalog.run,
		"library.declaredShelf": DeclaredShelf.run,
		"library.move": Move.run,
		"library.reader": Reader.run,
		"library.readerShelf": ReaderShelf.run,
		"library.rereadBook": RereadBook.run,
		"library.retitle": Retitle.run,
		"library.shelf": Shelf.run,
	}),
	"module handlers": moduleHandlers(Libraries),
};
export type Handlers = keyof typeof handlers;

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
