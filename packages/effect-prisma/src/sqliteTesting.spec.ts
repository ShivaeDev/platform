import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { makeSqliteDatabase } from "#sqlite.ts";
import { type Contract, contractJson } from "#test/sqlite/contract.ts";
import { makeTemporaryDatabase } from "#test/sqlite/makeTemporaryDatabase.ts";
import { withTestTransaction } from "#testing/transaction.ts";
import { makeDatabaseIt } from "#testing/vitest.ts";

const temporary = makeTemporaryDatabase();

const Database = makeSqliteDatabase<Contract>()("@test/SqliteTestingDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({ path: temporary.path });
const it = makeDatabaseIt({
	database: Database,
	layer: DatabaseLive,
});
const effectDB = it.effectDB;

it.afterAll(temporary.remove);

const ids = {
	each: crypto.randomUUID(),
	failed: crypto.randomUUID(),
	ordinaryNested: crypto.randomUUID(),
	rolledBack: crypto.randomUUID(),
};

effectDB("passes the typed database facade and Vitest context to the generator", function* (db, context) {
	expect(context.task.name).toContain("passes the typed database facade");

	const user = yield* db.User.create({
		email: `${ids.rolledBack}@example.test`,
		id: ids.rolledBack,
		name: "Rolled back",
	});

	expect(user.id).toBe(ids.rolledBack);
	expect(yield* db.User.where({ id: ids.rolledBack }).exists()).toBe(true);
});

effectDB("does not retain successful writes from the previous test", function* (db) {
	expect(yield* db.User.where({ id: ids.rolledBack }).exists()).toBe(false);
});

effectDB.each([
	{ id: ids.each, name: "First" },
	{ id: ids.each, name: "Second" },
])("supports table-driven rollback tests", function* (example, db) {
	expect(yield* db.User.where({ id: example.id }).exists()).toBe(false);

	const user = yield* db.User.create({
		email: `${example.name}-${example.id}@example.test`,
		id: example.id,
		name: example.name,
	});

	expect(user.name).toBe(example.name);
});

effectDB.fails("rolls back a failed Effect", function* (db) {
	yield* db.User.create({
		email: `${ids.failed}@example.test`,
		id: ids.failed,
		name: "Failed",
	});

	return yield* Effect.fail("expected test failure");
});

effectDB("does not retain writes from an expected failure", function* (db) {
	expect(yield* db.User.where({ id: ids.failed }).exists()).toBe(false);
});

effectDB("exposes the framework-neutral forced-rollback primitive", function* (db) {
	const nestedId = crypto.randomUUID();

	yield* withTestTransaction(
		Database,
		Effect.gen(function* () {
			const transactionDb = yield* Database;
			yield* transactionDb.User.create({
				email: `${nestedId}@example.test`,
				id: nestedId,
				name: "Nested",
			});
		}),
	);

	expect(yield* db.User.where({ id: nestedId }).exists()).toBe(true);
});

effectDB("reuses the forced-rollback scope for an ordinary transaction", function* (db) {
	const outer = yield* Database;
	expect(outer).toBe(db);

	yield* db.transaction(
		Effect.gen(function* () {
			const inner = yield* Database;
			expect(inner).toBe(outer);
			yield* inner.User.create({
				email: `${ids.ordinaryNested}@example.test`,
				id: ids.ordinaryNested,
				name: "Ordinary nested transaction",
			});
		}),
	);

	expect(yield* db.User.where({ id: ids.ordinaryNested }).exists()).toBe(true);
});

effectDB("rolls back an ordinary transaction nested in the previous test scope", function* (db) {
	expect(yield* db.User.where({ id: ids.ordinaryNested }).exists()).toBe(false);
});
