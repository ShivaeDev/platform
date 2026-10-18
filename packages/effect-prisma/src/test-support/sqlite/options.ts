import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { makeSqliteDatabase } from "#sqlite.ts";
import { type Contract, contractJson } from "#test/sqlite/contract.ts";
import { Database, temporary } from "#test/sqlite/database.ts";
import { makeTemporaryDatabase } from "#test/sqlite/makeTemporaryDatabase.ts";

function read<T>(path: string, query: (database: DatabaseSync) => T): T {
	const database = new DatabaseSync(path);
	try {
		return query(database);
	} finally {
		database.close();
	}
}

const OptionsDatabase = makeSqliteDatabase<Contract>()("@test/SqliteOptionsDatabase", { contractJson });
const AuditDatabase = makeSqliteDatabase<Contract>()("@test/SqliteAuditDatabase", { contractJson });

export function sqliteOptions() {
	return {
		blankPath: () => Effect.exit(OptionsDatabase.pipe(Effect.provide(OptionsDatabase.layer({ path: " \t " })))),
		foreignInclude: () =>
			Effect.acquireUseRelease(
				Effect.sync(makeTemporaryDatabase),
				(file) =>
					Effect.gen(function* () {
						const db = yield* Database;
						const auditDb = yield* AuditDatabase;
						const foreign: Effect.Effect<unknown, unknown> = Reflect.apply(db.User.include, db.User, ["posts", auditDb.Post]);
						return yield* Effect.exit(foreign);
					}).pipe(Effect.provide(AuditDatabase.layer({ path: file.path }))),
				(file) => Effect.sync(file.remove),
			),
		journalMode: () => read(temporary.path, (database) => database.prepare("PRAGMA journal_mode").get()?.journal_mode),
		storedCreatedAt: (id: string) =>
			read(temporary.path, (database) => String(database.prepare('SELECT "created_at" FROM "user" WHERE "id" = ?').get(id)?.created_at)),
		withoutPragmas: () =>
			Effect.acquireUseRelease(
				Effect.sync(makeTemporaryDatabase),
				(file) =>
					Effect.flatMap(OptionsDatabase, (db) => db.User.count()).pipe(
						Effect.provide(OptionsDatabase.layer({ path: file.path, pragmas: [] })),
						Effect.map(() => read(file.path, (database) => database.prepare("PRAGMA journal_mode").get()?.journal_mode)),
					),
				(file) => Effect.sync(file.remove),
			),
	};
}
