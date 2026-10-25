import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows, listeningForChanges } from "#test/sqlTraits.ts";

for (const count of [1000, 1001]) {
	postgres.it(
		`an insertMany of ${count} rows announces its returned rows only after commit`,
		[listeningForChanges(), hasNotificationRows()],
		function* ({ makeRepository, notificationTable, notifications, transact, watchChanges }) {
			const tableName = notificationTable();
			const { state } = notifications();
			const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
			const delivered = yield* watchChanges([tableName, `${tableName}:*`, `${tableName}:0`, `${tableName}:1000`]);
			yield* Effect.gen(function* () {
				yield* rows.insertMany(Array.from({ length: count }, (_, id) => ({ id, parent: null })));
				expect(state.payloads).toEqual([]);
				expect(delivered).toEqual([]);
			}).pipe(transact({ onSqlError: (error) => error }));
			const expected =
				count === 1001 ? [tableName, `${tableName}:*`] : [tableName, ...Array.from({ length: count }, (_, id) => `${tableName}:${id}`)];
			yield* eventually(Effect.try(() => expect(state.payloads.flatMap((payload) => JSON.parse(payload))).toEqual(expected)));
			yield* eventually(Effect.try(() => expect(delivered).toEqual(count === 1001 ? [tableName, `${tableName}:*`] : [tableName, `${tableName}:0`])));
		},
	);
}

postgres.it(
	"an upsertMany that only updates 1001 existing rows announces the collection",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications }) {
		const tableName = notificationTable();
		const { binding, state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Rows", tableName });
		const inputs = Array.from({ length: 1001 }, (_, id) => ({ id, parent: null }));
		yield* rows.insertMany(inputs);
		const updated = yield* rows
			.upsertMany(
				inputs.map((row) => ({ ...row, parent: 0 })),
				{ updateColumns: ["parent"] },
			)
			.pipe(Effect.provideContext(binding));
		expect(updated.map(({ id, parent }) => ({ id, parent }))).toEqual(inputs.map(({ id }) => ({ id, parent: 0 })));
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:*`]])));
	},
);

postgres.it(
	"ignored rows do not count towards the per-call threshold across chunks",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications }) {
		const tableName = notificationTable();
		const { binding, state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Rows", tableName });
		yield* rows.insert({ id: 0, parent: null });
		yield* rows.insertManyOrIgnore(Array.from({ length: 1001 }, (_, id) => ({ id, parent: null }))).pipe(Effect.provideContext(binding));
		yield* eventually(
			Effect.try(() =>
				expect(state.payloads.flatMap((payload) => JSON.parse(payload))).toEqual([
					tableName,
					...Array.from({ length: 1000 }, (_, index) => `${tableName}:${index + 1}`),
				]),
			),
		);
	},
);

postgres.it(
	"conditional upserts count changed rows across their statements",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications }) {
		const tableName = notificationTable();
		const { binding, state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Rows", tableName });
		const inputs = Array.from({ length: 1001 }, (_, id) => ({ id, parent: null }));
		yield* rows.insertMany(inputs);
		yield* rows
			.upsertMany(
				inputs.map((row) => ({ ...row, parent: 0 })),
				{ updateColumns: ["parent"], updateWhere: { parent: null } },
			)
			.pipe(Effect.provideContext(binding));
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:*`]])));
	},
);
