import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { timersStory } from "#test/timers/story.tsx";

for (const duration of [300, 700]) {
	timersStory.it(`settling a search waits for its ${duration} ms debounce`, [], function* ({ setDebounce, search, settle, results, isBusy }) {
		yield* setDebounce(duration);
		expect(yield* results()).toBe("All foods");

		yield* search("apple");

		yield* outcomes([
			["pending debounce", () => isBusy(), true],
			["results before debounce", () => results(), "All foods"],
		]);

		yield* settle();

		yield* outcomes([
			["debounced results", () => results(), "Results for apple"],
			["pending work", () => isBusy(), false],
		]);
	});
}

timersStory.it("typing again restarts the debounce window", [], function* ({ search, timePasses, results }) {
	yield* search("app");
	yield* timePasses(200);
	yield* search("apple");
	yield* timePasses(100);

	expect(yield* results()).toBe("All foods");

	yield* timePasses(200);

	expect(yield* results()).toBe("Results for apple");
});

timersStory.it("holding the diary row selects it at 450 ms", [], function* ({ beginPress, timePasses, row, selectionEvents }) {
	expect(yield* row()).toBe("Diary row");

	yield* beginPress();
	yield* timePasses(449);

	expect(yield* row()).toBe("Diary row");

	yield* timePasses(1);

	yield* outcomes([
		["selected row", () => row(), "Selected diary row"],
		["selection callbacks", () => selectionEvents(), ["selected"]],
	]);
});

for (const [action, cancel] of [
	["releasing", "releasePress"],
	["canceling", "cancelPress"],
	["leaving", "leaveRow"],
] as const) {
	timersStory.it(`${action} the row cancels a pending long press`, [], function* (verbs) {
		yield* verbs.beginPress();
		yield* verbs.timePasses(200);
		yield* verbs[cancel]();
		yield* verbs.timePasses(500);

		yield* outcomes([
			["unselected row", () => verbs.row(), "Diary row"],
			["pending work", () => verbs.isBusy(), false],
		]);
	});
}

timersStory.it(
	"unmounting cancels pending timers while the registry stays alive",
	[],
	function* ({ search, beginPress, close, advanceNextTimer, timePasses, selectionEvents }) {
		yield* search("apple");
		yield* beginPress();

		yield* close();

		expect(yield* advanceNextTimer()).toBe("no timer");

		yield* timePasses(1000);

		expect(yield* selectionEvents()).toEqual([]);
	},
);

timersStory.it("changing the debounce duration restarts its pending window", [], function* ({ search, timePasses, setDebounce, results }) {
	yield* search("apple");
	yield* timePasses(200);
	yield* setDebounce(500);
	yield* timePasses(300);

	expect(yield* results()).toBe("All foods");

	yield* timePasses(200);

	expect(yield* results()).toBe("Results for apple");
});

timersStory.it("starting another delay replaces the pending long press", [], function* ({ beginPress, timePasses, row, selectionEvents }) {
	yield* beginPress();
	yield* timePasses(200);
	yield* beginPress();
	yield* timePasses(250);

	expect(yield* row()).toBe("Diary row");

	yield* timePasses(200);

	yield* outcomes([
		["selected row", () => row(), "Selected diary row"],
		["selection callbacks", () => selectionEvents(), ["selected"]],
	]);
});

timersStory.it("changing the delay duration cancels the pending long press", [], function* ({ beginPress, setDelay, timePasses, row, isBusy }) {
	yield* beginPress();
	yield* timePasses(200);
	yield* setDelay(600);
	yield* timePasses(1000);

	yield* outcomes([
		["unselected row", () => row(), "Diary row"],
		["pending work", () => isBusy(), false],
	]);
});
