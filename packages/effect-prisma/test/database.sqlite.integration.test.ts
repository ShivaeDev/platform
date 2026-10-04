import { DatabaseSync } from "node:sqlite";
import { it } from "@effect/vitest";
import { Cause, Clock, Effect, Exit, Layer } from "effect";
import { afterAll, expect } from "vitest";
import { makeSqliteDatabase } from "#sqlite.ts";
import { type Contract, contractJson } from "#test/sqlite/contract.ts";
import { Database, DatabaseLive, temporary, uniqueEmail, withDatabase } from "#test/sqlite/database.ts";
import { makeTemporaryDatabase } from "#test/sqlite/support.ts";
import { withTestTransaction } from "#testing/transaction.ts";

const auditTemporary = makeTemporaryDatabase();
afterAll(auditTemporary.remove);

const AuditDatabase = makeSqliteDatabase<Contract>()("@test/SqliteAuditDatabase", {
	contractJson,
});
const AuditDatabaseLive = AuditDatabase.layer({ path: auditTemporary.path });
const withDatabases = Effect.provide(Layer.merge(DatabaseLive, AuditDatabaseLive));

const journalMode = (path: string): unknown => {
	const database = new DatabaseSync(path);
	try {
		return database.prepare("PRAGMA journal_mode").get()?.journal_mode;
	} finally {
		database.close();
	}
};

const storedCreatedAt = (path: string, id: string): string => {
	const database = new DatabaseSync(path);
	try {
		const row = database.prepare('SELECT "created_at" FROM "user" WHERE "id" = ?').get(id);
		return String(row?.created_at);
	} finally {
		database.close();
	}
};

it.effect("applies connect-time pragmas to the database file", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			yield* db.User.count();

			expect(journalMode(temporary.path)).toBe("wal");
		}),
	),
);

it.effect("owns the client and commits successful transactions", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("commit");
			const relation = db.User.where({ email });

			expect(yield* relation.exists()).toBe(false);

			yield* db.transaction(
				Effect.gen(function* () {
					const transactionDb = yield* Database;
					yield* transactionDb.User.create({
						email,
						id: crypto.randomUUID(),
						name: "Committed",
					});
				}),
			);

			expect(yield* relation.exists()).toBe(true);
		}),
	),
);

it.effect("runs a captured Relation in the active transaction", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("captured-relation");
			const create = db.User.create({
				email,
				id: crypto.randomUUID(),
				name: "Captured",
			});

			const failure = yield* Effect.flip(
				db.transaction(
					Effect.gen(function* () {
						yield* Database;
						yield* create;
						return yield* Effect.fail("rollback");
					}),
				),
			);

			expect(failure).toBe("rollback");
			expect(yield* db.User.where({ email }).exists()).toBe(false);
		}),
	),
);

it.effect("returns structured query failures", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("unique");

			yield* db.User.create({
				email,
				id: crypto.randomUUID(),
				name: "Original",
			});

			const error = yield* Effect.flip(
				db.User.create({
					email,
					id: crypto.randomUUID(),
					name: "Duplicate",
				}),
			);

			expect(error._tag).toBe("PrismaError");
			expect(error.reason._tag).toBe("PrismaQueryFailure");
			if (error.reason._tag === "PrismaQueryFailure") {
				expect(error.reason.sqlState).toBe("23505");
				expect(error.reason.constraint).toBe("user.email");
			}
		}),
	),
);

it.effect("refuses an included Relation from another Database", () =>
	withDatabases(
		Effect.gen(function* () {
			const db = yield* Database;
			const auditDb = yield* AuditDatabase;
			const foreign: Effect.Effect<unknown, unknown> = Reflect.apply(db.User.include, db.User, ["posts", auditDb.Post]);
			const exit = yield* Effect.exit(foreign);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.pretty(exit.cause)).toContain("Included Relations must use the same Database");
			}
		}),
	),
);

it.effect("uses Date values for SQLite datetime columns", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const createdAt = new Date("2026-08-03T12:34:56.789Z");
				const verifiedAt = new Date("2026-08-03T14:00:00.123Z");
				const user = yield* db.User.create({
					createdAt,
					email: uniqueEmail("timestamp"),
					id: crypto.randomUUID(),
					name: "Timestamp",
					verifiedAt,
				});

				expect(user.createdAt).toBeInstanceOf(Date);
				expect(user.createdAt.getTime()).toBe(createdAt.getTime());
				expect(user.verifiedAt).toBeInstanceOf(Date);
				expect(user.verifiedAt?.getTime()).toBe(verifiedAt.getTime());
				expect(yield* db.User.where((row) => row.createdAt.eq(createdAt)).exists()).toBe(true);
			}),
		),
	),
);

it.live("decodes the zone-less column default as UTC", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const id = crypto.randomUUID();
			const before = yield* Clock.currentTimeMillis;
			const user = yield* db.User.create({
				email: uniqueEmail("default-timestamp"),
				id,
				name: "Default timestamp",
			});

			const stored = storedCreatedAt(temporary.path, id);
			expect(stored).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u);

			expect(user.createdAt).toBeInstanceOf(Date);
			expect(user.createdAt.toISOString()).toBe(`${stored.replace(" ", "T")}.000Z`);
			expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
			expect(user.createdAt.getTime()).toBeLessThanOrEqual((yield* Clock.currentTimeMillis) + 1000);
		}),
	),
);
