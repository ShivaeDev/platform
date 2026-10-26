import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { columns } from "#test/insertSelect.ts";
import { hasInsertSelectRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows, listeningForChanges } from "#test/sqlTraits.ts";

for (const operation of ["insertFromSelect", "insertFromSelectOrIgnore"] as const) {
	postgres.it(
		`${operation} announces the collection when its selection returns 1001 rows`,
		[listeningForChanges(), hasInsertSelectRows()],
		function* ({ insertSelect, notifications }) {
			const { source, target, targetTable } = insertSelect();
			yield* source.insertMany(
				Array.from({ length: 1001 }, (_, index) => ({ amount: index, displayName: `row ${index}`, sourceKey: index + 5, status: "bulk" })),
			);
			const { binding, state } = notifications();
			yield* target[operation](source.select({ where: { status: "bulk" } }), columns).pipe(Effect.provideContext(binding));
			yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[targetTable, `${targetTable}:*`]])));
		},
	);
}

postgres.it(
	"a filter deleting more than 1000 rows announces the collection",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ makeRepository, notificationTable, notifications }) {
		const tableName = notificationTable();
		const { binding, state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		yield* rows.insertMany(Array.from({ length: 1001 }, (_, id) => ({ id, parent: null })));
		yield* rows.delete({ parent: null }).pipe(Effect.provideContext(binding));
		yield* eventually(Effect.try(() => expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:*`]])));
	},
);
