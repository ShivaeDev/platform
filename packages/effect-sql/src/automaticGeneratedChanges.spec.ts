import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { hasCompositeReadings, hasGeneratedRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasVersionedDocuments, listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"generated IDs are announced by unversioned void inserts",
	[listeningForChanges(), hasGeneratedRows()],
	function* ({ generatedRows, notifications, transact }) {
		const { generated, tableName } = generatedRows();
		yield* generated.insertVoid({}).pipe(transact({ onSqlError: (error) => error }));
		const [row] = yield* generated.findMany();
		expect(row).toBeDefined();
		yield* eventually(
			Effect.try(() =>
				expect(notifications().state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:${row?.id}`]]),
			),
		);
	},
);

postgres.it(
	"versioned void inserts, updates and deletes announce their returned ID",
	[listeningForChanges(), hasVersionedDocuments()],
	function* ({ versions, notifications, transact }) {
		const { documents, tableName } = versions();
		yield* documents.insertVoid({ name: "Draft" }).pipe(transact({ onSqlError: (error) => error }));
		const row = yield* documents.findById(1);
		yield* documents.updateVoid({ ...row, name: "Published" }).pipe(transact({ onSqlError: (error) => error }));
		yield* documents.delete(row.id, 1).pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(
			Effect.try(() =>
				expect(notifications().state.payloads.map((payload) => JSON.parse(payload))).toEqual(
					Array.from({ length: 3 }, () => [tableName, `${tableName}:${row.id}`]),
				),
			),
		);
	},
);

postgres.it(
	"composite row keys stay stable across several writes in a transaction",
	[listeningForChanges(), hasCompositeReadings()],
	function* ({ compositeReadings, notifications, transact }) {
		const { readings, tableName } = compositeReadings();
		yield* Effect.gen(function* () {
			const row = yield* readings.insert({ amount: 7, label: "Imported", sequence: 1, source: "meter" });
			yield* readings.updateVoid({ ...row, amount: 8 });
			yield* readings.delete({ sequence: 1, source: "meter" });
		}).pipe(transact({ onSqlError: (error) => error }));
		yield* eventually(
			Effect.try(() =>
				expect(notifications().state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:["meter","1"]`]]),
			),
		);
	},
);
