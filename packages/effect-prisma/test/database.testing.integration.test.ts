import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { makeDatabase } from "../src/index.js";
import { makeDatabaseIt, withTestTransaction } from "../src/testing.js";
import { type Contract, contractJson } from "./contract.js";

const databaseUrl = process.env.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL;
const Database = makeDatabase<Contract>("@test/TestingDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});
const it = makeDatabaseIt({
	database: Database,
	layer: DatabaseLive,
});
const effectDB = it.effectDB;
const integrationOptions = { skip: databaseUrl === undefined };

const ids = {
	each: crypto.randomUUID(),
	failed: crypto.randomUUID(),
	rolledBack: crypto.randomUUID(),
};

effectDB(
	"passes the typed database facade and Vitest context to the generator",
	function* (db, context) {
		expect(context.task.name).toContain("passes the typed database facade");

		const user = yield* db.User.create({
			id: ids.rolledBack,
			email: `${ids.rolledBack}@example.test`,
			name: "Rolled back",
		});

		expect(user.id).toBe(ids.rolledBack);
		expect(yield* db.User.where({ id: ids.rolledBack }).exists()).toBe(true);
	},
	integrationOptions,
);

effectDB(
	"does not retain successful writes from the previous test",
	function* (db) {
		expect(yield* db.User.where({ id: ids.rolledBack }).exists()).toBe(false);
	},
	integrationOptions,
);

effectDB.each([
	{ id: ids.each, name: "First" },
	{ id: ids.each, name: "Second" },
])(
	"supports table-driven rollback tests",
	function* (example, db) {
		expect(yield* db.User.where({ id: example.id }).exists()).toBe(false);

		const user = yield* db.User.create({
			id: example.id,
			email: `${example.name}-${example.id}@example.test`,
			name: example.name,
		});

		expect(user.name).toBe(example.name);
	},
	integrationOptions,
);

effectDB.fails(
	"rolls back a failed Effect",
	function* (db) {
		yield* db.User.create({
			id: ids.failed,
			email: `${ids.failed}@example.test`,
			name: "Failed",
		});

		return yield* Effect.fail("expected test failure");
	},
	integrationOptions,
);

effectDB(
	"does not retain writes from an expected failure",
	function* (db) {
		expect(yield* db.User.where({ id: ids.failed }).exists()).toBe(false);
	},
	integrationOptions,
);

effectDB(
	"exposes the framework-neutral forced-rollback primitive",
	function* (db) {
		const nestedId = crypto.randomUUID();

		yield* withTestTransaction(
			Database,
			db.User.create({
				id: nestedId,
				email: `${nestedId}@example.test`,
				name: "Nested",
			}),
		);

		expect(yield* db.User.where({ id: nestedId }).exists()).toBe(true);
	},
	integrationOptions,
);
