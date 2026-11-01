import { expect } from "vitest";
import { atLeast, lessThan } from "#adapters/outcomeMatchers.ts";
import { outcomes } from "#outcomes.ts";
import { defaultBudgets, hiddenLoading, loading, loadingScreen, missingSave, stuckLoading } from "#test/loadingScreen.tsx";

const MISSING = 'died: The screen has 0 matches for button named "Save".';

for (const indicator of ["status", "busy", "root busy", "text", "text dots", "dialog", "native dialog"] as const) {
	loadingScreen.it(`finds the Save button past the normal timeout with ${indicator}`, [loading(indicator)], function* ({ find, elapsed }) {
		yield* outcomes([
			["find", () => find(), "succeeded"],
			["elapsed", () => elapsed(), atLeast(40)],
		]);
	});
}

loadingScreen.it(
	"a verb built on find waits past the default three seconds while loading",
	[loading("text"), defaultBudgets],
	function* ({ clickSave, elapsed, text }) {
		yield* clickSave();

		yield* outcomes([
			["elapsed", () => elapsed(), atLeast(3000)],
			["screen", () => text(), expect.stringContaining("Saved")],
		]);
	},
);

loadingScreen.it("findText waits past the normal timeout while loading", [loading("status")], function* ({ findText, elapsed }) {
	yield* outcomes([
		["find text", () => findText(), "succeeded"],
		["elapsed", () => elapsed(), atLeast(40)],
	]);
});

for (const [name, traits] of [
	["without loading", []],
	["with hidden loading", [loading("status"), hiddenLoading]],
	["with a closed dialog", [loading("closed dialog")]],
] as const) {
	loadingScreen.it(`fails at the normal timeout ${name}`, traits, function* ({ find, elapsed }) {
		yield* outcomes([
			["find", () => find(), MISSING],
			["normal deadline", () => elapsed(), atLeast(40)],
			["before the loading deadline", () => elapsed(), lessThan(500)],
		]);
	});
}

loadingScreen.it("a scoped find ignores loading in an outside portal", [loading("dialog")], function* ({ findScoped, elapsed }) {
	yield* outcomes([
		["find", () => findScoped(), MISSING],
		["before the loading deadline", () => elapsed(), lessThan(500)],
	]);
});

loadingScreen.it("bounds the longer wait when loading never finishes", [loading("status"), stuckLoading], function* ({ find, elapsed }) {
	yield* outcomes([
		["find", () => find(), MISSING],
		["loading deadline", () => elapsed(), atLeast(500)],
		["bounded wait", () => elapsed(), lessThan(1000)],
	]);
});

loadingScreen.it("fails as soon as loading ends without the target", [loading("status"), missingSave], function* ({ find, elapsed }) {
	yield* outcomes([
		["find", () => find(), MISSING],
		["past the normal deadline", () => elapsed(), atLeast(40)],
		["before the loading deadline", () => elapsed(), lessThan(500)],
	]);
});

loadingScreen.it("respects an explicit timeout even while loading", [loading("status"), stuckLoading], function* ({ find, elapsed }) {
	yield* outcomes([
		["find", () => find({ timeout: 40 }), MISSING],
		["normal deadline", () => elapsed(), atLeast(40)],
		["before the loading deadline", () => elapsed(), lessThan(500)],
	]);
});
