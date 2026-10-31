import { Order } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeKeys, recordInList1, sourceRecordInList2, watchesList, watchesOwner, watchesRecord } from "#test/changeKeys.ts";

const RECORD_1_IN_LIST_1 = ["listId 1", 'owner "alice"', "record 1", "the table"];
const RECORD_2_IN_LIST_2 = ["listId 2", 'owner "bob"', "record 2", "the table"];

changeKeys.it(
	"an insert announces its generated record and only its own buckets, after it commits",
	[watchesList(1), watchesList(2), watchesOwner("alice"), watchesOwner("bob"), watchesRecord(1)],
	function* ({ insertRecord, inTransaction, publishedKeys, woken }) {
		yield* inTransaction(function* () {
			yield* insertRecord(1, "alice");
			expect(yield* woken()).toEqual([]);
		});

		yield* outcomes({
			"published keys": [publishedKeys(), RECORD_1_IN_LIST_1],
			"woken watchers": [woken(), ["list 1", "owner alice", "record 1"]],
		});
	},
);

for (const operation of [
	"update",
	"updateVoid",
	"upsert",
	"upsertMany",
	"conditionalUpsert",
	"conditionalUpsertMany",
	"versionedUpdate",
	"versionedUpdateVoid",
] as const) {
	changeKeys.it(
		`${operation} moving a record announces its old and its new buckets`,
		[recordInList1(), watchesList(1), watchesList(2), watchesList(3)],
		function* ({ moveRecordThrough, publishedKeys, woken }) {
			yield* moveRecordThrough(operation);

			yield* outcomes({
				"published keys": [publishedKeys(), ["listId 1", "listId 2", 'owner "alice"', 'owner "bob"', "record 1", "the table"]],
				"woken watchers": [woken(), ["list 1", "list 2"]],
			});
		},
	);
}

for (const operation of ["delete", "versionedDelete"] as const) {
	changeKeys.it(
		`${operation} announces the deleted record and its buckets`,
		[recordInList1()],
		function* ({ deleteRecordThrough, publishedKeys, storedRecords }) {
			yield* deleteRecordThrough(operation);

			yield* outcomes({
				"published keys": [publishedKeys(), RECORD_1_IN_LIST_1],
				"stored records": [storedRecords(), []],
			});
		},
	);
}

for (const operation of ["insert", "insertVoid", "insertMany", "insertOrIgnore", "versionedInsertVoid", "versionedInsertOrIgnore"] as const) {
	changeKeys.it(`${operation} announces the inserted record and its buckets`, [recordInList1()], function* ({ insertRecordThrough, publishedKeys }) {
		yield* insertRecordThrough(operation);

		expect(yield* publishedKeys()).toEqual(RECORD_2_IN_LIST_2);
	});
}

for (const operation of ["insertFromSelect", "insertFromSelectOrIgnore"] as const) {
	changeKeys.it(
		`${operation} announces the copied record's generated key and its buckets`,
		[sourceRecordInList2()],
		function* ({ copySourceRecordThrough, publishedKeys }) {
			yield* copySourceRecordThrough(operation);

			expect(yield* publishedKeys()).toEqual(["listId 2", 'owner "bob"', "record 1", "the table"]);
		},
	);
}

changeKeys.it(
	"clearing a record's nullable list still announces the list it left",
	[recordInList1()],
	function* ({ clearRecordList, publishedKeys }) {
		yield* clearRecordList();

		expect(yield* publishedKeys()).toEqual(RECORD_1_IN_LIST_1);
	},
);

changeKeys.it(
	"a bulk insert of 1001 records announces every record key and only its own buckets",
	[watchesList(1), watchesList(2)],
	function* ({ insertRecords, publishedKeys, woken }) {
		yield* insertRecords(1001);

		yield* outcomes({
			"published keys": [
				publishedKeys(),
				["listId 1", 'owner "alice"', "the table", ...Array.from({ length: 1001 }, (_, index) => `record ${index + 1}`)].toSorted(Order.String),
			],
			"woken watchers": [woken(), ["list 1"]],
		});
	},
);
