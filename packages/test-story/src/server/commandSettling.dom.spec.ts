import { expect } from "@effect/vitest";
import { outcomes } from "#server/outcomes.ts";
import { activityPage } from "#test/activityPage.ts";

activityPage.it(
	"a command receipt settles while a live query waits for its next result",
	[],
	function* ({ shown, holdRefresh, startHintWait, writeElsewhere, refreshStarted, enter, click, settle, saved }) {
		expect(yield* shown()).toBe("First page");
		yield* holdRefresh();
		const hint = yield* startHintWait();
		yield* writeElsewhere("Another viewer's page");
		yield* hint.finish;
		yield* refreshStarted();
		yield* enter("input", "Saved page");

		yield* click({ name: "Save", role: "button" });
		yield* settle();

		expect(yield* saved()).toBe("Saved page");
	},
);

activityPage.it("settling waits for a new live query's first result", [], function* ({ click, startSettling, secondTitle, releaseSecondPage }) {
	yield* click({ name: "Open second page", role: "button" });
	const settling = yield* startSettling();

	yield* outcomes([
		["screen settlement", () => settling.state, "waiting"],
		["second page", secondTitle, "Loading second page"],
	]);
	yield* releaseSecondPage();
	yield* settling.finish;

	expect(yield* secondTitle()).toBe("Second page");
});

activityPage.it(
	"settling waits for the command receipt",
	[],
	function* ({ shown, holdSave, enter, click, saveStarted, startSettling, releaseSave, saved }) {
		yield* shown();
		yield* holdSave();
		yield* enter("input", "Confirmed page");

		yield* click({ name: "Save", role: "button" });
		yield* saveStarted();
		const settling = yield* startSettling();
		yield* outcomes([
			["screen settlement", () => settling.state, "waiting"],
			["command receipt", saved, "No receipt"],
		]);
		yield* releaseSave();
		yield* settling.finish;

		expect(yield* saved()).toBe("Confirmed page");
	},
);

activityPage.it("closing a screen releases a live query awaiting its first result", [], function* ({ click, secondTitle, closePage, settle }) {
	yield* click({ name: "Open second page", role: "button" });
	expect(yield* secondTitle()).toBe("Loading second page");

	yield* closePage();
	yield* settle();
});
