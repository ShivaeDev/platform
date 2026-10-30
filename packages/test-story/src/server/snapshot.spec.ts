import { expect } from "@effect/vitest";
import { outcomes } from "#outcomes.ts";
import { blockedSnapshotFile, inspectThatThrows, nativeBakeryState, snapshotPrinter } from "#test/snapshotDiagnostics.ts";

const LONG_ORDER = "rye".repeat(50);

snapshotPrinter.it("prints the error an inspect hook throws in place of the bakery", [], function* ({ printedLines, prints }) {
	yield* prints(inspectThatThrows("inventory is closed"));

	expect(yield* printedLines()).toEqual(["The bakery when the test failed is unknown: its inspect hook threw inventory is closed"]);
});

snapshotPrinter.it("prints native runtime values in words and marks repeated references", [], function* ({ heading, printedValue, prints }) {
	yield* prints(nativeBakeryState);

	yield* outcomes({
		heading: [heading(), "The bakery when the test failed:"],
		"printed bakery": [
			printedValue(),
			{
				counters: { loaves: 0 },
				duplicate: "[shown above]",
				identifier: "9007199254740993n",
				ingredients: { '{"grain":"rye"}': 2 },
				marker: "Symbol(waiting)",
				orders: ["rye", "oat"],
				problem: "RangeError: capacity exceeded",
				self: "[shown above]",
			},
		],
	});
});

snapshotPrinter.it("prints an inspect hook that returns nothing as undefined", [], function* ({ printedLines, prints }) {
	yield* prints(() => undefined);

	expect(yield* printedLines()).toEqual(["The bakery when the test failed: undefined"]);
});

snapshotPrinter.it("wraps a long collection between its complete JSON members", [], function* ({ printedLines, prints }) {
	const orders = ["rye".repeat(20), "oat".repeat(20), "barley".repeat(10)];

	yield* prints(() => orders);

	expect(yield* printedLines()).toEqual(["The bakery when the test failed:", `["${orders[0]}",`, `"${orders[1]}",`, `"${orders[2]}"]`]);
});

for (const [shape, value] of [
	["an object with one long member", { order: LONG_ORDER }],
	["a long string", LONG_ORDER],
	["a collection of one long member", [LONG_ORDER]],
] as const) {
	snapshotPrinter.it(`keeps ${shape} on one line though it exceeds the terminal width`, [], function* ({ printedLines, prints }) {
		yield* prints(() => value);

		expect(yield* printedLines()).toEqual(["The bakery when the test failed:", JSON.stringify(value)]);
	});
}

snapshotPrinter.it(
	"reports the filesystem error when a large snapshot cannot be written",
	[],
	function* ({ reportDetails, reportMessage, reportsWithItsSnapshotFileBlocked }) {
		yield* reportsWithItsSnapshotFileBlocked(() => ({ orders: "rye".repeat(1000) }));

		yield* outcomes({
			details: [reportDetails(), { code: "EISDIR", errno: -21, path: blockedSnapshotFile, syscall: "open" }],
			message: [
				reportMessage(),
				`test-story could not print the story of this bakery: EISDIR: illegal operation on a directory, open '${blockedSnapshotFile}'`,
			],
		});
	},
);
