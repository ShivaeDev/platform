import { Context, Effect, Layer, Logger, Option, Redacted, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";
import { readSql } from "@shivaedev/sql/readSql.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { defineModule } from "#defineModule.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { command, query } from "#operation.ts";
import { CurrentViewer, signedIn, type Viewer } from "#readPolicy.ts";

export class StoredBook extends Model.Class<StoredBook>("LibraryBook")({ id: Schema.Number, shelf: bucket(Schema.Number), title: Schema.String }) {}
export class StoredLoan extends Model.Class<StoredLoan>("LibraryLoan")({ book: Schema.Number, id: Schema.Number, reader: bucket(Schema.String) }) {}
export class StoredReader extends Model.Class<StoredReader>("LibraryReader")({ name: Schema.String, shelf: Schema.Number }) {}
export const books = collection("library_books", Schema.Number, { shelf: Schema.Number });
const readerRows = collection("library_readers", Schema.String);
const loans = collection("library_loans", Schema.Number, { reader: Schema.String });

export const makeBooks = makeRepository(StoredBook, { collection: books, idColumn: "id", spanPrefix: "LibraryBooks", tableName: "library_books" });
export const makeLoans = makeRepository(StoredLoan, { collection: loans, idColumn: "id", spanPrefix: "LibraryLoans", tableName: "library_loans" });
export const makeReaders = makeRepository(StoredReader, { idColumn: "name", spanPrefix: "LibraryReaders", tableName: "library_readers" });

export class Library extends Context.Service<
	Library,
	{
		readonly books: Effect.Success<typeof makeBooks>;
		readonly loans: Effect.Success<typeof makeLoans>;
		readonly readers: Effect.Success<typeof makeReaders>;
	}
>()("@shivaedev/contract/test/Library") {}
export class LoggedWarnings extends Context.Service<LoggedWarnings, string[]>()("@shivaedev/contract/test/LoggedWarnings") {
	static readonly layer = Layer.unwrap(
		Effect.sync(() => {
			const warnings: string[] = [];
			const logger = Logger.make(({ logLevel, message }) => {
				if (logLevel === "Warn") {
					warnings.push(Array.isArray(message) ? message.join(" ") : String(message));
				}
			});
			return Layer.merge(Layer.succeed(LoggedWarnings, warnings), Logger.layer([logger]));
		}),
	);
}
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
		Effect.gen(function* () {
			const { readers } = yield* Library;
			yield* recordRead([readerRows.item(readerOf(viewer))]);
			return Option.isSome(yield* Effect.orDie(readers.findOne({ where: { name: readerOf(viewer) } })));
		}),
	*run({ shelf }) {
		return yield* titlesOn(shelf);
	},
	success: Titles,
});
const Title = Schema.Struct({ title: Schema.String });
const LoansOnShelf = query("loansOnShelf", {
	payload: { reader: Schema.String, shelf: Schema.Number },
	readPolicy: signedIn,
	*run({ reader, shelf }) {
		const rows = yield* Effect.orDie(readSql`
			select b.title from library_books b
			join library_loans l on l.book = b.id
			where b.shelf = ${books.bucket.shelf(shelf)} and l.reader = ${loans.bucket.reader(reader)}
			order by b.id`);
		return (yield* Effect.orDie(Schema.decodeUnknownEffect(Schema.Array(Title))(rows))).map(({ title }) => title);
	},
	success: Titles,
});
const EveryLoan = query("everyLoan", {
	readPolicy: signedIn,
	*run() {
		const { loans: rows } = yield* Library;
		return (yield* Effect.orDie(rows.findMany(byId))).map(({ book, reader }) => `${reader} has book ${book}`);
	},
	success: Titles,
});
const unmarkedTitles = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* Effect.orDie(sql`select title from library_books order by id`);
	return (yield* Effect.orDie(Schema.decodeUnknownEffect(Schema.Array(Title))(rows))).map(({ title }) => title);
});
const UnmarkedTitles = query("unmarkedTitles", {
	readPolicy: signedIn,
	*run() {
		return yield* unmarkedTitles;
	},
	success: Titles,
});
const UnmarkedTitlesReadingNothing = query("unmarkedTitlesReadingNothing", {
	readPolicy: signedIn,
	reads: () => [],
	*run() {
		return yield* unmarkedTitles;
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

const Lend = command("lend", {
	payload: { book: Schema.Number, id: Schema.Number, reader: Schema.String },
	*run(loan) {
		const { loans: rows } = yield* Library;
		yield* Effect.orDie(rows.insertVoid(loan));
	},
});

export const Libraries = defineModule({
	middleware: LibraryViewer,
	name: "library",
	operations: [
		Book,
		RereadBook,
		Shelf,
		DeclaredShelf,
		Catalog,
		Reader,
		ReaderShelf,
		LoansOnShelf,
		EveryLoan,
		UnmarkedTitles,
		UnmarkedTitlesReadingNothing,
		Retitle,
		Move,
		Lend,
	],
	requires: [Library],
});

export const handlers = {
	"hand-written handlers": Libraries.application.toLayer({
		"library.book": Book.run,
		"library.catalog": Catalog.run,
		"library.declaredShelf": DeclaredShelf.run,
		"library.everyLoan": EveryLoan.run,
		"library.lend": Lend.run,
		"library.loansOnShelf": LoansOnShelf.run,
		"library.move": Move.run,
		"library.reader": Reader.run,
		"library.readerShelf": ReaderShelf.run,
		"library.rereadBook": RereadBook.run,
		"library.retitle": Retitle.run,
		"library.shelf": Shelf.run,
		"library.unmarkedTitles": UnmarkedTitles.run,
		"library.unmarkedTitlesReadingNothing": UnmarkedTitlesReadingNothing.run,
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
			yield* sql`create table library_loans (id integer primary key, book integer not null, reader text not null)`;
			yield* sql`insert into library_loans values (1, 1, 'alice'), (2, 3, 'alice')`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

export { configured };
export const database = Layer.merge(
	makePostgresTestLayer({ migrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	LoggedWarnings.layer,
);
