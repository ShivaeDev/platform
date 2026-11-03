import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { events, saved } from "#test/kit.ts";

events.it(
	"a request id already used on another stream is already done and appends nothing to that stream",
	[saved("rename", "Original")],
	function* ({ append, history }) {
		const ending = yield* append("rename", ["Repeated"], 0, "bob");

		expect(ending).toBe("already done");
		expect(yield* history("bob")).toEqual([]);
	},
);

events.it("events round-trip Schema values through their JSON codec", [], function* ({ appendCount, storedCounts }) {
	yield* appendCount(5n);

	expect(yield* storedCounts()).toEqual([5n]);
});

events.it("a command appends a batch in stream order and projects its rows", [], function* ({ append, history, storedRows }) {
	yield* append("rename", ["Draft", "Published"]);

	yield* outcomes([
		["stored events", () => history(), [{ name: "Draft" }, { name: "Published" }]],
		[
			"projected rows",
			() => storedRows(),
			[
				{ name: "Draft", stream: "alice" },
				{ name: "Published", stream: "alice" },
			],
		],
	]);
});

events.it("a failed projection rolls back the batch and its earlier projected rows", [], function* ({ append, history, storedRows }) {
	const ending = yield* append("rename", ["Draft", "Rejected"]);

	expect(ending).toBe("projection rejected");
	yield* outcomes([
		["stored events", () => history(), []],
		["projected rows", () => storedRows(), []],
	]);
});

events.it("a rolled back command leaves its request id and stream version available for retry", [], function* ({ append, history }) {
	yield* append("rename", ["Rejected"]);

	const ending = yield* append("rename", ["Recovered"]);

	expect(ending).toBe("appended");
	expect(yield* history()).toEqual([{ name: "Recovered" }]);
});

events.it(
	"a repeated request id is already done and keeps the original events and rows",
	[saved("rename", "Original")],
	function* ({ append, history, storedRows }) {
		const ending = yield* append("rename", ["Repeated"]);

		expect(ending).toBe("already done");
		yield* outcomes([
			["stored events", () => history(), [{ name: "Original" }]],
			["projected rows", () => storedRows(), [{ name: "Original", stream: "alice" }]],
		]);
	},
);

events.it("two concurrent requests for one stream append once and return a typed version conflict once", [], function* ({ storedRows, writersRace }) {
	const endings = yield* writersRace();

	expect(endings).toEqual(["appended", "conflict at 1, expected 0"]);
	const rows = yield* storedRows();
	expect(rows).toEqual([{ name: expect.stringMatching(/^(?:alice|bob)$/u), stream: "shared" }]);
});

events.it("concurrent repeats of a request append once and recognise the other as already done", [], function* ({ writersRace }) {
	const endings = yield* writersRace(true);

	expect(endings).toEqual(["already done", "appended"]);
});

events.it("a live query refreshes after the command commits its projection", [], function* ({ append, liveRows }) {
	expect(yield* liveRows()).toEqual([]);

	yield* append("rename", ["Published"]);

	expect(yield* liveRows()).toEqual([{ name: "Published", stream: "alice" }]);
});
