import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { areasAnswered, paneColumns, pluginPane } from "#test/pluginPane.ts";

const holder = { prUrl: "https://github.com/example/project/pull/42", stage: "reviewing", workId: "Build Fleet" };
const queue = ["First", "Second", "Third", "Fourth", "Fifth"].map((workId) => ({ prUrl: null, stage: "queued", workId }));
const availability = areasAnswered([
	{ area: "work-fleet", holders: [holder], queue },
	{ area: "work-board", holders: [], queue: queue.slice(0, 1) },
	{ area: "free", holders: [], queue: [] },
]);

pluginPane.it(
	"area chips distinguish a held long queue, a short queue and idle work",
	[availability, paneColumns(32)],
	function* ({ areaState, click, areaDetails }) {
		yield* outcomes([
			["Held area", () => areaState("work-fleet"), { color: "#d74253", state: "held · 5 queued" }],
			["Short queue", () => areaState("work-board"), { color: "#ad7400", state: "unheld · 1 queued" }],
			["Idle area", () => areaState("free"), { color: "#16853f", state: "free" }],
		]);
		yield* click("work-fleet");
		expect(yield* areaDetails()).toEqual([
			"work-fleet",
			"Holds Build Fleet · reviewing #42",
			"1. First · queued",
			"2. Second · queued",
			"3. Third · queued",
			"4. Fourth · queued",
			"5. Fifth · queued",
		]);
		yield* click("work-board");
		expect(yield* areaDetails()).toEqual(["work-board", "No holder", "1. First · queued"]);
		yield* click("free");
		expect(yield* areaDetails()).toEqual(["free", "No holder", "No approved tasks queued"]);
		yield* click("free");
		expect(yield* areaDetails()).toEqual([]);
	},
);

pluginPane.it("an older Fleet reply leaves area availability unknown", [], function* ({ lookOf }) {
	expect(yield* lookOf("This Fleet has not supplied area availability.")).toBe("dimmed");
});
