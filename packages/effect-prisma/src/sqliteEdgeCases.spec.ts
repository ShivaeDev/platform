import { DatabaseSync } from "node:sqlite";
import { Cause, Effect, Exit } from "effect";
import { afterAll, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { makeSqliteDatabase } from "#sqlite.ts";
import { type Contract, contractJson } from "#test/sqlite/contract.ts";
import { makeTemporaryDatabase } from "#test/sqlite/makeTemporaryDatabase.ts";

const temporary = makeTemporaryDatabase();
afterAll(temporary.remove);
const Database = makeSqliteDatabase<Contract>()("@test/SqliteOptionsDatabase", { contractJson });

it.effect("rejects a blank SQLite path before opening an ephemeral database", function* () {
	const exit = yield* Effect.exit(Database.pipe(Effect.provide(Database.layer({ path: " \t " }))));

	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain(
			"Effect Prisma requires a file-backed SQLite database; transactions run on their own connection and cannot see an in-memory database",
		);
	}
});

it.effect("honors an empty pragma list without enabling WAL", function* () {
	yield* Effect.flatMap(Database, (db) => db.User.count()).pipe(Effect.provide(Database.layer({ path: temporary.path, pragmas: [] })));
	const database = new DatabaseSync(temporary.path);
	try {
		expect(database.prepare("PRAGMA journal_mode").get()?.journal_mode).toBe("delete");
	} finally {
		database.close();
	}
});
