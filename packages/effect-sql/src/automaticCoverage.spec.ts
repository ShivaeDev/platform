import { Effect } from "effect";
import { expect } from "vitest";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows } from "#test/sqlTraits.ts";

postgres.it(
	"a discarded repository announcement cannot cover a later raw write",
	[hasNotificationRows()],
	function* ({ withChangeCoverage, makeRepository, notificationTable, sql, transact }) {
		const tableName = notificationTable();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		const discarded = rows
			.insert({ id: 1, parent: null })
			.pipe(Effect.andThen(Effect.fail("savepoint")), transact({ onSqlError: (error) => error }), Effect.ignore);
		const failure = yield* withChangeCoverage(
			Effect.gen(function* () {
				yield* discarded;
				yield* sql`insert into ${sql(tableName)} (id) values (2)`;
			}),
		).pipe(Effect.flip);
		expect(failure).toMatchObject({ _tag: "UnannouncedWrites", tables: [tableName] });
		expect(yield* rows.findMany()).toEqual([]);
	},
);

postgres.it(
	"coverage excludes rolled-back counters and preserves the enclosing announcement",
	[hasNotificationRows()],
	function* ({ withChangeCoverage, makeRepository, notificationTable, sql, transact }) {
		const tableName = notificationTable();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		function rollback<A, E, R>(body: Effect.Effect<A, E, R>) {
			return body.pipe(Effect.andThen(Effect.fail("savepoint")), transact({ onSqlError: (error) => error }), Effect.ignore);
		}
		yield* withChangeCoverage(
			Effect.gen(function* () {
				yield* rollback(rows.insert({ id: 1, parent: null }));
				yield* rollback(sql`insert into ${sql(tableName)} (id) values (2)`);
				yield* rollback(
					Effect.gen(function* () {
						yield* rollback(rows.insert({ id: 3, parent: null }));
						yield* sql`insert into ${sql(tableName)} (id) values (4)`;
					}),
				);
			}),
		);
		expect(yield* rows.findMany()).toEqual([]);
		yield* withChangeCoverage(
			Effect.gen(function* () {
				yield* rows.insert({ id: 5, parent: null });
				yield* rollback(rows.update({ id: 5, parent: 5 }));
			}),
		);
		expect(yield* rows.findMany()).toEqual([{ id: 5, parent: null }]);
	},
);
