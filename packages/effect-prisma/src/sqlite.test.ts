import { Cause, Clock, Effect, Exit } from "effect";
import { expect } from "vitest";
import { Database, uniqueEmail } from "#test/sqlite/database.ts";
import { rollbackWrites, sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("applies connect-time pragmas to the database file", [], function* ({ db, storage }) {
	yield* db.User.count();

	expect(storage.journalMode()).toBe("wal");
});

sqliteStory.it("owns the client and commits successful transactions", [], function* ({ db }) {
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
});

sqliteStory.it("runs a captured Relation in the active transaction", [], function* ({ db }) {
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
});

sqliteStory.it("returns structured query failures", [], function* ({ db }) {
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
});

sqliteStory.it("refuses an included Relation from another Database", [], function* ({ storage }) {
	const exit = yield* storage.foreignInclude();
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("Included Relations must use the same Database");
	}
});

sqliteStory.it("uses Date values for SQLite datetime columns", [rollbackWrites()], function* ({ transact }) {
	return yield* transact(
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
	);
});

sqliteStory.it(
	"decodes the zone-less column default as UTC",
	[],
	function* ({ db, storage }) {
		const id = crypto.randomUUID();
		const before = yield* Clock.currentTimeMillis;
		const user = yield* db.User.create({
			email: uniqueEmail("default-timestamp"),
			id,
			name: "Default timestamp",
		});

		const stored = storage.storedCreatedAt(id);
		expect(stored).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u);

		expect(user.createdAt).toBeInstanceOf(Date);
		expect(user.createdAt.toISOString()).toBe(`${stored.replace(" ", "T")}.000Z`);
		expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
		expect(user.createdAt.getTime()).toBeLessThanOrEqual((yield* Clock.currentTimeMillis) + 1000);
	},
	{ clock: "live" },
);
