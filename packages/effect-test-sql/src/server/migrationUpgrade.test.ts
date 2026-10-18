import { Cause, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, MIXED_CASE_LEDGER, populatedMixedCaseLedger } from "#test/migrationUpgrade.ts";
import { secondClient } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

app.it("upgrades committed old migrations and returns exact live PostgreSQL column types", [], function* ({ adding, assertModel, upgrade }) {
	const database = yield* PostgresTestDatabase;
	const observer = yield* secondClient(database.url);
	const checkCommitted = Effect.gen(function* () {
		expect(yield* observer`select old_name from items`.withoutTransform).toEqual([{ "old_name": "kept" }]);
	});
	let loads = 0;
	const loader = Effect.tap(adding([2, "check_committed", Effect.succeed(checkCommitted)]), () =>
		Effect.sync(() => {
			loads += 1;
		}),
	);
	const columns = yield* upgrade({ loader });
	expect(loads).toBe(1);
	expect(columns).toEqual([
		{ name: "id", type: "integer" },
		{ name: "name", type: "text" },
		{ name: "price", type: "numeric(10,2)" },
	]);
	yield* assertModel(columns);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select name from items`).toEqual([{ name: "kept" }]);
	expect(yield* sql`select migration_id from upgrade_migrations order by migration_id`).toEqual([
		{ "migration_id": 1 },
		{ "migration_id": 2 },
		{ "migration_id": 3 },
	]);
});

app.it("rejects an unknown migration id, a populated ledger and a wrapping transaction", [], function* ({ upgrade }) {
	expect((yield* upgrade({}, 2).pipe(Effect.flip)).message).toBe("Migration 2 is not in the loader.");
	expect((yield* withTestTransaction(upgrade()).pipe(Effect.flip)).message).toContain("outside a wrapping transaction");
	yield* upgrade();
	expect((yield* upgrade().pipe(Effect.flip)).message).toContain("empty migration ledger");
});

app.it("rejects a populated mixed-case ledger before loading or running migrations", [populatedMixedCaseLedger], function* ({ adding, upgrade }) {
	let loads = 0;
	let runs = 0;
	const pending = Effect.sync(() => {
		runs += 1;
	});
	const loader = Effect.tap(adding([4, "must_not_run", Effect.succeed(pending)]), () =>
		Effect.sync(() => {
			loads += 1;
		}),
	);
	expect(yield* upgrade({ loader, table: MIXED_CASE_LEDGER }).pipe(Effect.flip)).toMatchObject({
		_tag: "MigrationError",
		kind: "BadState",
		message: "Migration upgrade checks require an empty migration ledger.",
	});
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select migration_id from ${sql(MIXED_CASE_LEDGER)}`).toEqual([{ "migration_id": 3 }]);
	expect(yield* sql`select name from items`).toEqual([{ name: "kept" }]);
	expect(loads).toBe(0);
	expect(runs).toBe(0);
});

for (const [name, statement, problem] of [
	["missing", "alter table items drop column price", "Missing column: price"],
	["extra", "alter table items add column surprise text", "Extra column: surprise"],
	["wrongly typed", "alter table items alter column name type varchar(30)", "Wrong type for name: expected text, received character varying(30)"],
] as const) {
	app.it(`the model assertion fails for a ${name} PostgreSQL column`, [], function* ({ adding, assertModel, upgrade }) {
		const sql = yield* SqlClient.SqlClient;
		const columns = yield* upgrade({ loader: adding([4, "drift", Effect.succeed(sql.unsafe(statement))]) });
		expect((yield* Effect.flip(assertModel(columns))).problems).toEqual([problem]);
	});
}

app.it("retains loader failures and migration defects while preserving the committed old schema", [], function* ({ adding, upgrade }) {
	const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader failed" });
	expect(yield* upgrade({ loader: Effect.fail(failure) }).pipe(Effect.flip)).toBe(failure);
	const sql = yield* SqlClient.SqlClient;
	const exit = yield* upgrade({ loader: adding([4, "broken", Effect.succeed(sql`alter table items drop column absent`)]) }).pipe(Effect.exit);
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("MigrationError");
	}
	expect(yield* sql`select old_name from items`).toEqual([{ "old_name": "kept" }]);
	expect(yield* sql`select migration_id from upgrade_migrations`).toEqual([{ "migration_id": 1 }]);
});
