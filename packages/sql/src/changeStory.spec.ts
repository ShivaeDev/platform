import { Effect } from "effect";
import { expect } from "vitest";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows } from "#test/sqlTraits.ts";

postgres.it("declared domain read keys cover raw SQL writes", [hasNotificationRows()], function* (test) {
	const table = test.notificationTable();
	const covers = { [table]: ["dashboard:activity"] };
	yield* test.withChangeCoverage(
		Effect.gen(function* () {
			yield* test.sql`insert into ${test.sql(table)} (id) values (1)`;
			yield* test.invalidateOnCommit(["dashboard:activity"]);
		}),
		{ covers },
	);
	const unrecorded = yield* test.withChangeCoverage(test.sql`insert into ${test.sql(table)} (id) values (2)`, { covers }).pipe(Effect.flip);
	expect(unrecorded).toMatchObject({ _tag: "UnannouncedWrites", tables: [table] });
	const undeclared = yield* test
		.withChangeCoverage(
			Effect.gen(function* () {
				yield* test.sql`insert into ${test.sql(table)} (id) values (2)`;
				yield* test.invalidateOnCommit(["dashboard:activity"]);
			}),
		)
		.pipe(Effect.flip);
	expect(undeclared).toMatchObject({ _tag: "UnannouncedWrites", tables: [table] });
	const unrelated = yield* test
		.withChangeCoverage(
			Effect.gen(function* () {
				yield* test.sql`insert into ${test.sql(table)} (id) values (3)`;
				yield* test.invalidateOnCommit(["another:domain"]);
			}),
			{ covers },
		)
		.pipe(Effect.flip);
	expect(unrelated).toMatchObject({ _tag: "UnannouncedWrites", tables: [table] });
	expect(yield* test.sql`select id from ${test.sql(table)}`).toEqual([{ id: 1 }]);
});

postgres.it("publication assertions observe committed keys and preserve delivery", [hasNotificationRows()], function* (test) {
	const table = test.notificationTable();
	const rows = yield* test.makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName: table });
	const delivered = yield* test.watchChanges([table, `${table}:1`]);
	const row = yield* rows.insert({ id: 1, parent: null }).pipe(test.expectPublished([`${table}:1`, table]));
	expect(row).toEqual({ id: 1, parent: null });
	expect(delivered).toEqual([table, `${table}:1`]);
	yield* rows
		.insert({ id: 2, parent: null })
		.pipe(Effect.andThen(Effect.fail("rollback")), test.transact({ onSqlError: (error) => error }), Effect.ignore, test.expectPublished([]));
	expect(yield* rows.findMany()).toEqual([{ id: 1, parent: null }]);
});

postgres.it("publication mismatches name expected and actual keys after commit", [hasNotificationRows()], function* (test) {
	const table = test.notificationTable();
	const failure = yield* Effect.gen(function* () {
		yield* test.sql`insert into ${test.sql(table)} (id) values (1)`;
		yield* test.invalidateOnCommit(["activity:recent"]);
	}).pipe(test.transact({ onSqlError: (error) => error }), test.expectPublished(["activity:missing"]), Effect.flip);
	expect(failure).toMatchObject({ _tag: "PublishedKeysMismatch", actual: ["activity:recent"], expected: ["activity:missing"] });
	expect(failure.message).toBe('Expected published keys ["activity:missing"]; actual published keys ["activity:recent"]');
	expect(yield* test.sql`select id from ${test.sql(table)}`).toEqual([{ id: 1 }]);
});
