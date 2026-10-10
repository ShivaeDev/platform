import { expect } from "@effect/vitest";
import { engineSnapshot } from "#internal/engineSnapshot.ts";
import { failureReport } from "#internal/failureReport.ts";
import { bakery } from "#test/bakery.ts";
import { blockedSnapshotFile, nativeBakeryState, snapshotTest, withBlockedSnapshot } from "#test/snapshotDiagnostics.ts";

bakery.it("reports the specific error when the inspect hook throws", [], ({ story }) => {
	const inspectionError = new Error("inventory is closed");
	const lines = engineSnapshot(
		{
			engine: story.engine,
			inspect: () => {
				throw inspectionError;
			},
			name: "bakery",
		},
		snapshotTest,
	);
	expect(lines).toEqual(["The bakery when the test failed is unknown: its inspect hook threw inventory is closed"]);
});

bakery.it("shows native runtime values and repeated references in the inspected engine", [], ({ story }) => {
	const lines = engineSnapshot({ engine: story.engine, inspect: nativeBakeryState, name: "bakery" }, snapshotTest);
	expect(lines[0]).toBe("The bakery when the test failed:");
	expect(JSON.parse(lines.slice(1).join(""))).toEqual({
		counters: { loaves: 0 },
		duplicate: "[shown above]",
		identifier: "9007199254740993n",
		ingredients: { '{"grain":"rye"}': 2 },
		marker: "Symbol(waiting)",
		orders: ["rye", "oat"],
		problem: "RangeError: capacity exceeded",
		self: "[shown above]",
	});
	expect(lines.every((line) => line.length <= 120)).toBe(true);
});

bakery.it("prints an inspect hook that has no state to return", [], ({ story }) => {
	expect(engineSnapshot({ engine: story.engine, inspect: () => undefined, name: "bakery" }, snapshotTest)).toEqual([
		"The bakery when the test failed: undefined",
	]);
});

bakery.it("wraps an inspected collection between complete JSON members", [], ({ story }) => {
	const orders = ["rye".repeat(20), "oat".repeat(20), "barley".repeat(10)];
	const lines = engineSnapshot({ engine: story.engine, inspect: () => orders, name: "bakery" }, snapshotTest);
	expect(lines).toEqual(["The bakery when the test failed:", `["${orders[0]}",`, `"${orders[1]}",`, `"${orders[2]}"]`]);
	expect(JSON.parse(lines.slice(1).join(""))).toEqual(orders);
});

bakery.it("keeps an indivisible JSON value intact when it exceeds terminal width", [], ({ story }) => {
	const order = "rye".repeat(50);
	for (const value of [{ order }, order, [order]]) {
		expect(engineSnapshot({ engine: story.engine, inspect: () => value, name: "bakery" }, snapshotTest)).toEqual([
			"The bakery when the test failed:",
			JSON.stringify(value),
		]);
	}
});

bakery.it("reports the real filesystem error when a large snapshot cannot be written", [], ({ story }) => {
	withBlockedSnapshot(() => {
		const report = failureReport(
			{ at: undefined, given: 0, lines: [], refused: undefined, sites: [], tell: story.tell, tellAt: story.tell },
			{ engine: story.engine, inspect: () => ({ orders: "rye".repeat(1000) }), name: "bakery" },
			snapshotTest,
		);
		const [message, details] = report.split(" {");
		expect(message).toBe(
			`test-story could not print the story of this bakery: EISDIR: illegal operation on a directory, open '${blockedSnapshotFile}'`,
		);
		expect(JSON.parse(`{${details}`)).toEqual({ code: "EISDIR", errno: -21, path: blockedSnapshotFile, syscall: "open" });
	});
});
