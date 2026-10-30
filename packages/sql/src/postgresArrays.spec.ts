import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { codecs, samplesExist } from "#test/codecs.ts";

const INT4_EXTREMES = [-2_147_483_648, -1, 0, 2_147_483_647];
const EMPTY_INT4_ARRAY = { missing: false, size: 0, type: "integer[]" };

codecs.it("insert stores an empty array as a typed empty int4[] and reads it back empty", [], function* ({ insertSample, sample, storedArray }) {
	yield* insertSample(2, []);

	yield* outcomes({
		"sample 2 as read back": [sample(2), { id: 2, values: [] }],
		"stored array": [storedArray(2), EMPTY_INT4_ARRAY],
	});
});

codecs.it("insert round-trips the int4 extremes", [], function* ({ insertSample, sample }) {
	yield* insertSample(1, INT4_EXTREMES);

	expect(yield* sample(1)).toEqual({ id: 1, values: INT4_EXTREMES });
});

codecs.it(
	"an equality filter on an empty array matches only the empty sample",
	[
		samplesExist([
			{ id: 1, values: [3] },
			{ id: 2, values: [] },
		]),
	],
	function* ({ samplesWithValues }) {
		const found = yield* samplesWithValues([]);

		expect(found).toEqual([{ id: 2, values: [] }]);
	},
);

for (const [write, from, to] of [
	["updateSample", [1, 2], []],
	["updateSampleVoid", [], [1, 2]],
] as const) {
	codecs.it(
		`${write === "updateSample" ? "update" : "updateVoid"} changes a sample from [${from.join(", ")}] to [${to.join(", ")}]`,
		[samplesExist([{ id: 1, values: from }])],
		function* (verbs) {
			yield* verbs[write](1, to);

			expect(yield* verbs.sample(1)).toEqual({ id: 1, values: to });
		},
	);
}

codecs.it("insertMany writes and returns empty and non-empty arrays", [], function* ({ insertSamples, returned, sample }) {
	yield* insertSamples([
		{ id: 3, values: [] },
		{ id: 4, values: [3] },
	]);

	yield* outcomes({
		"returned samples": [
			returned(),
			[
				{ id: 3, values: [] },
				{ id: 4, values: [3] },
			],
		],
		"sample 3 as read back": [sample(3), { id: 3, values: [] }],
	});
});

codecs.it(
	"insertManyOrIgnore skips the existing sample, keeps its array and returns only the new empty one",
	[samplesExist([{ id: 4, values: [3] }])],
	function* ({ insertSamplesOrIgnore, returned, sample }) {
		yield* insertSamplesOrIgnore([
			{ id: 4, values: [] },
			{ id: 5, values: [] },
		]);

		yield* outcomes({
			"returned samples": [returned(), [{ id: 5, values: [] }]],
			"sample 4 as read back": [sample(4), { id: 4, values: [3] }],
		});
	},
);

codecs.it(
	"upsertMany replaces stored arrays with non-empty and typed empty arrays",
	[
		samplesExist([
			{ id: 3, values: [] },
			{ id: 4, values: [3] },
		]),
	],
	function* ({ returned, storedArray, upsertSampleValues }) {
		yield* upsertSampleValues([
			{ id: 3, values: [4, 5] },
			{ id: 4, values: [] },
		]);

		yield* outcomes({
			"returned results": [
				returned(),
				[
					{ inserted: false, row: { id: 3, values: [4, 5] } },
					{ inserted: false, row: { id: 4, values: [] } },
				],
			],
			"stored array of sample 4": [storedArray(4), EMPTY_INT4_ARRAY],
		});
	},
);
