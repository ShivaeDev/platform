import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changesWatched, measurementStored, missingUpdates, readingStored } from "#test/missingUpdates.ts";

const draft = { id: 1, label: "Draft", note: null, source: "meter" };

missingUpdates.it(
	"an onMissing fail update in a committed transaction returns the updated reading and announces its table and row only after commit",
	[readingStored(10), changesWatched("readings", ["1"])],
	function* ({ announced, announcedBeforeCommit, reading, returned, updateReadingOrFail }) {
		yield* updateReadingOrFail(20, "commits");

		yield* outcomes({
			"announced after commit": [announced(), ["readings", "readings:1"]],
			"announced before commit": [announcedBeforeCommit(), []],
			"returned reading": [returned(), [{ ...draft, amount: 20 }]],
			"stored reading": [reading(), { ...draft, amount: 20 }],
		});
	},
);

missingUpdates.it(
	"an onMissing fail update of an absent reading fails with no such row, runs only its update statement and announces nothing",
	[changesWatched("readings", ["1"])],
	function* ({ announced, endings, statementKinds, updateReadingOrFail }) {
		yield* updateReadingOrFail(20);

		yield* outcomes({
			"announced changes": [announced(), []],
			"statements run": [statementKinds(), ["update"]],
			"update ending": [endings(), ["failed with no such row"]],
		});
	},
);

missingUpdates.it(
	"an ordinary update of an absent reading dies and announces nothing",
	[changesWatched("readings", ["1"])],
	function* ({ announced, endings, updateReading }) {
		yield* updateReading(20);

		yield* outcomes({
			"announced changes": [announced(), []],
			"update ending": [endings(), ["died with no such row"]],
		});
	},
);

missingUpdates.it(
	"an onMissing fail update in a transaction that fails rolls back the reading and announces nothing",
	[readingStored(10), changesWatched("readings", ["1"])],
	function* ({ announced, endings, reading, updateReadingOrFail }) {
		yield* updateReadingOrFail(20, "fails");

		yield* outcomes({
			"announced changes": [announced(), []],
			"stored reading": [reading(), { ...draft, amount: 10 }],
			"transaction ending": [endings(), ["failed with cancelled"]],
		});
	},
);

missingUpdates.it(
	"an onMissing fail update by a codec-encoded composite key returns the measurement and announces its encoded row key only after commit",
	[measurementStored(1, 10), changesWatched("measurements", ['["encoded/meter",1]'])],
	function* ({ announced, announcedBeforeCommit, measurement, returned, updateMeasurementOrFail }) {
		yield* updateMeasurementOrFail(1, 20, "commits");

		yield* outcomes({
			"announced after commit": [announced(), ["measurements", 'measurements:["encoded/meter",1]']],
			"announced before commit": [announcedBeforeCommit(), []],
			"returned measurement": [returned(), [{ amount: 20, sequence: 1, source: "meter" }]],
			"stored measurement": [measurement(1), { amount: 20, sequence: 1, source: "meter" }],
		});
	},
);

missingUpdates.it(
	"an onMissing fail update of an absent composite key fails with no such row and leaves the measurement sharing its source unchanged",
	[measurementStored(1, 10), changesWatched("measurements", ['["encoded/meter",1]', '["encoded/meter",2]'])],
	function* ({ announced, endings, measurement, updateMeasurementOrFail }) {
		yield* updateMeasurementOrFail(2, 20, "commits");

		yield* outcomes({
			"announced changes": [announced(), []],
			"meter/1": [measurement(1), { amount: 10, sequence: 1, source: "meter" }],
			"update ending": [endings(), ["failed with no such row"]],
		});
	},
);
