import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows, listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"repository writes announce their table and each row once after the outer commit",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications, transact }) {
		const tableName = notificationTable();
		const { state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Rows", tableName });
		yield* Effect.gen(function* () {
			yield* rows.insertMany(Array.from({ length: 30 }, (_, id) => ({ id, parent: null })));
			yield* rows.update({ id: 1, parent: 0 });
			yield* rows.upsert({ id: 2, parent: 1 }, { updateColumns: ["parent"] });
			yield* rows.delete(3);
			expect(state.payloads).toEqual([]);
		}).pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(
			Effect.try(() =>
				expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([
					[tableName, ...Array.from({ length: 30 }, (_, id) => `${tableName}:${id}`)],
				]),
			),
		);
	},
);

postgres.it(
	"a standalone Many write commits one deduplicated notification and ignored rows stay silent",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications, transact }) {
		const tableName = notificationTable();
		const { state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Rows", tableName });
		const inputs = Array.from({ length: 30 }, (_, id) => ({ id, parent: null }));
		yield* rows.insertMany(inputs).pipe((body) => Effect.provideContext(body, notifications().binding));
		const announcedKeys = [tableName, ...inputs.map(({ id }) => `${tableName}:${id}`)];
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([announcedKeys])));
		yield* rows.insertManyOrIgnore(inputs).pipe(transact({ onSqlError: (error) => error }));
		yield* rows
			.upsertMany(
				inputs.map((row) => ({ ...row, parent: 0 })),
				{ updateColumns: ["parent"] },
			)
			.pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([announcedKeys, announcedKeys])));
	},
);

postgres.it(
	"rolled-back repository writes publish nothing, including a failed savepoint",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications, transact, sql }) {
		const tableName = notificationTable();
		const { state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		const rejected = yield* rows
			.insert({ id: 1, parent: null })
			.pipe(Effect.andThen(Effect.fail("rollback")), transact({ onSqlError: (error) => error }), Effect.result);
		expect(rejected).toMatchObject({ _tag: "Failure", failure: "rollback" });
		yield* Effect.gen(function* () {
			yield* rows.insert({ id: 2, parent: null });
			yield* rows
				.insert({ id: 3, parent: null })
				.pipe(Effect.andThen(Effect.fail("savepoint")), transact({ onSqlError: (error) => error }), Effect.ignore);
		}).pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:2`]])));
		expect(yield* sql`select id from ${sql(tableName)}`).toEqual([{ id: 2 }]);
	},
);

postgres.it(
	"the coverage verb rejects unannounced raw SQL and accepts repository writes",
	[hasNotificationRows()],
	function* ({ withChangeCoverage, makeRepository, notificationTable, sql }) {
		const tableName = notificationTable();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		yield* withChangeCoverage(rows.insert({ id: 1, parent: null }));
		const failure = yield* withChangeCoverage(sql`insert into ${sql(tableName)} (id) values (2)`).pipe(Effect.flip);
		expect(failure).toMatchObject({ _tag: "UnannouncedWrites", tables: [tableName] });
		expect(yield* rows.findMany()).toEqual([{ id: 1, parent: null }]);
	},
);

postgres.it(
	"void writes publish row keys, and missing deletes stay silent",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications, transact }) {
		const tableName = notificationTable();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		yield* rows.insertVoid({ id: 41, parent: null }).pipe(transact({ onSqlError: (error) => error }));
		yield* rows.updateVoid({ id: 41, parent: 41 }).pipe(transact({ onSqlError: (error) => error }));
		yield* rows.delete(41).pipe(transact({ onSqlError: (error) => error }));
		yield* rows.delete(41).pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(
			Effect.try(() =>
				expect(notifications().state.payloads.map((payload) => JSON.parse(payload))).toEqual(
					Array.from({ length: 3 }, () => [tableName, `${tableName}:41`]),
				),
			),
		);
	},
);
