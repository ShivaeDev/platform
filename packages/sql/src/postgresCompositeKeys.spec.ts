import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { conflicts, readingsExist } from "#test/conflicts.ts";

const readings = readingsExist([
	["meter", 1, 52],
	["meter", 2, 53],
	["other", 1, 54],
]);

conflicts.it("findById reads the reading whose source and sequence both match", [readings], function* ({ reading }) {
	yield* outcomes({
		"meter/1": [reading("meter", 1), { amount: 52, label: "original" }],
		"meter/2": [reading("meter", 2), { amount: 53, label: "original" }],
		"other/1": [reading("other", 1), { amount: 54, label: "original" }],
	});
});

conflicts.it("findById with only part of the key fails with a schema error", [readings], function* ({ endings, findReadingWithoutSequence }) {
	yield* findReadingWithoutSequence();

	expect(yield* endings()).toEqual(["failed with a schema error"]);
});

conflicts.it(
	"insertOrIgnore of a taken key is ignored and keeps the stored reading",
	[readings],
	function* ({ endings, insertReadingOrIgnore, reading }) {
		yield* insertReadingOrIgnore("meter", 1, 99);

		yield* outcomes({
			"insertOrIgnore ending": [endings(), ["ignored"]],
			"meter/1": [reading("meter", 1), { amount: 52, label: "original" }],
		});
	},
);

conflicts.it("insertOrIgnore of a new sequence for a known source inserts it", [readings], function* ({ endings, insertReadingOrIgnore, reading }) {
	yield* insertReadingOrIgnore("meter", 3, 99);

	yield* outcomes({
		"insertOrIgnore ending": [endings(), ["inserted"]],
		"meter/3": [reading("meter", 3), { amount: 99, label: "offered" }],
	});
});

conflicts.it(
	"upsert of a taken key updates only the listed amount and reports an update",
	[readings],
	function* ({ reading, returned, upsertReading }) {
		yield* upsertReading("meter", 1, 60, "ignored");

		yield* outcomes({
			"meter/1": [reading("meter", 1), { amount: 60, label: "original" }],
			"returned value": [returned(), [{ inserted: false, row: { amount: 60, label: "original" } }]],
		});
	},
);

conflicts.it("upsert of a new key inserts the reading and reports an insert", [readings], function* ({ reading, returned, upsertReading }) {
	yield* upsertReading("meter", 4, 60, "fresh");

	yield* outcomes({
		"meter/4": [reading("meter", 4), { amount: 60, label: "fresh" }],
		"returned value": [returned(), [{ inserted: true, row: { amount: 60, label: "fresh" } }]],
	});
});

for (const write of ["update", "updateVoid"] as const) {
	conflicts.it(`${write} of meter/2 changes only that reading`, [readings], function* ({ reading, updateReading }) {
		yield* updateReading("meter", 2, 80, write);

		yield* outcomes({
			"meter/1": [reading("meter", 1), { amount: 52, label: "original" }],
			"meter/2": [reading("meter", 2), { amount: 80, label: "original" }],
			"other/1": [reading("other", 1), { amount: 54, label: "original" }],
		});
	});
}

conflicts.it("delete of meter/1 removes only that reading", [readings], function* ({ deleteReading, readingKeys }) {
	expect(yield* readingKeys()).toEqual(["meter/1", "meter/2", "other/1"]);

	yield* deleteReading("meter", 1);

	expect(yield* readingKeys()).toEqual(["meter/2", "other/1"]);
});

conflicts.it(
	"an upsert and an insertOrIgnore inside a failing transaction roll back",
	[readings],
	function* ({ endings, inFailingTransaction, insertReadingOrIgnore, reading, readingKeys, upsertReading }) {
		yield* inFailingTransaction(function* () {
			yield* upsertReading("meter", 2, 100, "ignored");
			yield* insertReadingOrIgnore("meter", 5, 100);
		});

		yield* outcomes({
			"meter/2": [reading("meter", 2), { amount: 53, label: "original" }],
			"stored keys": [readingKeys(), ["meter/1", "meter/2", "other/1"]],
			"write endings": [endings(), ["succeeded", "inserted", "failed with cancelled"]],
		});
	},
);
