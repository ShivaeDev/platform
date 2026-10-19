import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayRowsFixture, todayTextAskFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const IDS = ["question.storage", "decision.reader", "task.person", "task.ship", "docs.policy"];
const ANSWERABLE = ["Where should the project documents live?", "Question for reader", "Ship the upload fix"];
const OPEN_ONLY = ["Human action", "Is every module supported API?"];

screenStory.it("leaves item IDs off Needs you rows for the item page to show", [routedScreen(todayRowsFixture(), "/", { home: "home.md" })], function* ({ ui }) {
	yield* Effect.promise(() => eventually(() => expect(ui.text({ name: "Needs you", role: "list" })).toContain("Ship the upload fix")));
	const rows = ui.text({ name: "Needs you", role: "list" });
	for (const id of IDS) {
		expect(rows).not.toContain(id);
	}
});

screenStory.it(
	"writes Needs you reasons as plain sentences for Fleet decisions and a person's notes",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ ui }) {
		yield* Effect.promise(() => eventually(() => expect(ui.text({ name: "Needs you", role: "list" })).toContain("Ship the upload fix")));
		const rows = ui.text({ name: "Needs you", role: "list" });
		expect(rows).toContain("Fleet asks: do you want changes before merging?");
		expect(rows).toContain("Every export is supported API.");
		expect(rows).toContain("Casey notes: Read the evidence");
		expect(rows).not.toContain("Managed decision");
		expect(rows).not.toContain("maintainer:");
		expect(rows).not.toContain("Dropped:");
	},
);

screenStory.it(
	"gives each Needs you row one action: Answer opens the question inline, Open links to the item page",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ findElements, location, ui }) {
		yield* Effect.promise(() => eventually(() => expect(ui.text({ name: "Answer Ship the upload fix", role: "button" })).toBe("Answer")));
		for (const row of findElements("ul[aria-label='Needs you'] > li")) {
			const [heading, ...actions] = findElements("a, button", row);
			const title = heading ? ui.accessible(heading).name : "";
			const label = actions[0]?.textContent;
			expect(["Answer", "Open"]).toContain(label);
			expect(actions.map((action) => ui.accessible(action))).toEqual([
				label === "Answer" ? { name: `Answer ${title}`, role: "button" } : { name: `Open ${title}`, role: "link" },
			]);
		}
		expect(ANSWERABLE.map((title) => ui.text({ name: `Answer ${title}`, role: "button" }))).toEqual(["Answer", "Answer", "Answer"]);
		expect(OPEN_ONLY.map((title) => ui.text({ name: `Open ${title}`, role: "link" }))).toEqual(["Open", "Open"]);

		yield* ui.click({ name: "Answer Where should the project documents live?", role: "button" });
		const options = ui.text({ name: "Answer Where should the project documents live?", role: "dialog" });
		expect(options).toContain("Keep local files · Recommended");
		expect(options).toContain("Use a database");
		yield* ui.click({ name: "Open question", role: "link" });
		yield* Effect.promise(() => eventually(() => expect(location()?.pathname).toBe("/_board/item/question.storage/")));
	},
);

screenStory.it(
	"records a text answer from the Today popover of a request without options",
	[routedScreen(todayTextAskFixture(), "/", { home: "home.md", writable: true })],
	function* ({ readResponses, ui }) {
		yield* Effect.promise(() => eventually(() => expect(ui.text({ name: "Answer Question for reader", role: "button" })).toBe("Answer")));
		yield* ui.click({ name: "Answer Question for reader", role: "button" });
		yield* ui.enter({ name: "Your answer", role: "textbox" }, "Publish the guide on Monday.");
		yield* ui.click({ name: "Record answer", role: "button" });
		yield* Effect.promise(() =>
			eventually(() => expect(ui.text({ name: "Answered, waiting for Fleet", role: "list" })).toContain("Question for reader")),
		);
		const saved = yield* Effect.promise(() => readResponses("decision.reader", "direction"));
		expect(saved.responses.map((entry) => entry.body)).toEqual(["Publish the guide on Monday."]);
	},
);

screenStory.it(
	"says answering is turned off in the Today popover of a read-only Board, without a CLI flag",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ ui }) {
		yield* Effect.promise(() =>
			eventually(() => expect(ui.text({ name: "Answer Where should the project documents live?", role: "button" })).toBe("Answer")),
		);
		yield* ui.click({ name: "Answer Where should the project documents live?", role: "button" });
		const dialog = ui.text({ name: "Answer Where should the project documents live?", role: "dialog" });
		expect(dialog).toContain("Answering is turned off on this Board.");
		expect(dialog).not.toContain("--responses");
	},
);
