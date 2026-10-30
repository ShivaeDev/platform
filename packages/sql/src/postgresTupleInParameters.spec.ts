import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries } from "#test/queries.ts";
import { PartialRow } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

const QUOTED = "one') OR true --";
const LIST_SIZE = 10_000;
const tuples = Array.from({ length: LIST_SIZE }, (_, index): readonly [string, number] => [index === LIST_SIZE - 1 ? QUOTED : `missing-${index}`, 1]);
const where = tupleIn(PartialRow, ["a", "b"], tuples);
const boundTuples = tuples.flatMap(([a, b]) => [a, String(b)]);
const savedRows = [
	{ a: QUOTED, b: 1, kind: "X", value: 10 },
	{ a: "other", b: 1, kind: "X", value: 20 },
];

queries.it(
	`findMany sends a ${LIST_SIZE}-tuple list, whose last tuple holds a quote and a SQL comment, as bound parameters and reads only that row`,
	[],
	function* ({ boundParameters, findPartialRows, lastResult, savePartialRows, sqlTextContains }) {
		yield* savePartialRows(savedRows);

		yield* findPartialRows({ select: ["a", "b"], where });

		yield* outcomes({
			"bound parameters": [boundParameters(), [boundTuples]],
			"found rows": [lastResult(), [{ a: QUOTED, b: 1 }]],
			"quote written into the SQL": [sqlTextContains(QUOTED), false],
		});
	},
);

queries.it(
	`a select copies the ${LIST_SIZE}-tuple list into its statement as bound parameters`,
	[],
	function* ({ boundParameters, selectPartialRows, lastResult, savePartialRows, sqlTextContains }) {
		yield* savePartialRows(savedRows);

		yield* selectPartialRows({ select: ["a"], where });

		yield* outcomes({
			"bound parameters": [boundParameters(), [boundTuples]],
			"quote written into the SQL": [sqlTextContains(QUOTED), false],
			"selected rows": [lastResult(), [{ a: QUOTED }]],
		});
	},
);

queries.it(
	`delete sends the ${LIST_SIZE}-tuple list as bound parameters and removes only the matching row`,
	[],
	function* ({ boundParameters, deletePartialRows, partialRows, savePartialRows, sqlTextContains }) {
		yield* savePartialRows(savedRows);

		yield* deletePartialRows(where);

		yield* outcomes({
			"bound parameters": [boundParameters(), [boundTuples]],
			"quote written into the SQL": [sqlTextContains(QUOTED), false],
			"stored rows": [partialRows(), [{ a: "other", b: 1 }]],
		});
	},
);
