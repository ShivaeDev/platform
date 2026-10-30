import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayRowsFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const IDS = ["question.storage", "decision.reader", "task.person", "task.ship", "docs.policy"];
const ANSWERABLE = ["Where should the project documents live?", "Question for reader", "Ship the upload fix"];
const OPEN_ONLY = [
	"Human action",
	"Is every module supported API?",
	"Plan the next release",
	"Which checks should block a release?",
	"Which mirror should serve downloads?",
];

screenStory.it(
	"leaves item IDs off Needs you rows for the item page to show",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ roles }) {
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).toContain("Ship the upload fix"));
		const rows = roles.text({ name: "Needs you", role: "list" });
		for (const id of IDS) {
			expect(rows).not.toContain(id);
		}
	},
);

screenStory.it(
	"writes Needs you reasons as plain sentences for Fleet decisions and a person's notes",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ roles }) {
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).toContain("Ship the upload fix"));
		const rows = roles.text({ name: "Needs you", role: "list" });
		expect(rows).toContain("Fleet asks: do you want changes before merging?");
		expect(rows).toContain("Every export is supported API.");
		expect(rows).toContain("Read the evidence");
		expect(rows).not.toContain("Managed decision");
		expect(rows).not.toContain("maintainer:");
		expect(rows).not.toContain("Draft:");
	},
);

screenStory.it(
	"gives each Needs you row one action: Answer opens the question inline, Open links to the item page, and its age adds no Tab stop",
	[
		routedScreen(todayRowsFixture(), "/", {
			home: "home.md",
			modified: new Map(Object.keys(todayRowsFixture()).map((path) => [path, Effect.runSync(Clock.currentTimeMillis) - 2 * 60 * 60 * 1000])),
		}),
	],
	function* ({ findElement, findElements, location, readTabStops, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Ship the upload fix", role: "button" })).toBe("Answer"));
		for (const row of findElements("ul[aria-label='Needs you'] > li")) {
			expect(findElement("time", row)?.textContent).toBe("2h ago");
			expect(readTabStops(row)).toEqual(findElements("a, button", row));
			const [heading, ...actions] = findElements("a, button", row);
			const title = heading ? roles.accessible(heading).name : "";
			const label = actions[0]?.textContent;
			expect(["Answer", "Open"]).toContain(label);
			expect(actions.map((action) => roles.accessible(action))).toEqual([
				label === "Answer" ? { name: `Answer ${title}`, role: "button" } : { name: `Open ${title}`, role: "link" },
			]);
		}
		expect(ANSWERABLE.map((title) => roles.text({ name: `Answer ${title}`, role: "button" }))).toEqual(["Answer", "Answer", "Answer"]);
		expect(OPEN_ONLY.map((title) => roles.text({ name: `Open ${title}`, role: "link" }))).toEqual(OPEN_ONLY.map(() => "Open"));

		yield* roles.click({ name: "Answer Where should the project documents live?", role: "button" });
		const options = roles.text({ name: "Answer Where should the project documents live?", role: "dialog" });
		expect(options).toContain("Keep local files · Recommended");
		expect(options).toContain("Use a database");
		yield* roles.click({ name: "Read the full question", role: "link" });
		yield* eventually(() => expect(location()?.pathname).toBe("/_board/item/question.storage/"));
	},
);

screenStory.it(
	"records a text answer from the Today popover of a request without options",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ readResponses, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Question for reader", role: "button" })).toBe("Answer"));
		yield* roles.click({ name: "Answer Question for reader", role: "button" });
		yield* roles.enter({ name: "Your answer", role: "textbox" }, "Publish the guide on Monday.");
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Answered", role: "list" })).toContain("Question for reader"));
		const saved = yield* Effect.promise(() => readResponses("decision.reader", "direction"));
		expect(saved.responses.map((entry) => entry.body)).toEqual(["Publish the guide on Monday."]);
	},
);

screenStory.it(
	"records a typed answer to a text question under its heading and the reader's author label",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ findElements, openDetails, readResponses, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Name the next release", role: "button" })).toBe("Answer"));
		yield* roles.click({ name: "Answer Name the next release", role: "button" });
		yield* roles.enter({ name: "What should the release be called?", role: "textbox" }, "Harbor");
		openDetails("[role='dialog'] details");
		yield* roles.enter({ name: "Answer as", role: "textbox" }, "");
		function record() {
			return findElements("[role='dialog'] button[type='submit']", document).map((button) => button.hasAttribute("disabled"));
		}
		expect(record()).toEqual([true]);
		yield* roles.enter({ name: "Answer as", role: "textbox" }, "Casey");
		expect(record()).toEqual([false]);
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).not.toContain("Name the next release"));
		const saved = yield* Effect.promise(() => readResponses("decision.name", "direction"));
		expect(saved.responses.map((entry) => [entry.response.author, entry.response.answers])).toEqual([
			["Casey", [{ prompt: "name", selected: [], text: "Harbor" }]],
		]);
	},
);

screenStory.it(
	"tells the reader why a Today answer was not saved when the question changed after the popover opened",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ editFile, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Name the next release", role: "button" })).toBe("Answer"));
		yield* roles.click({ name: "Answer Name the next release", role: "button" });
		yield* roles.enter({ name: "What should the release be called?", role: "textbox" }, "Harbor");
		editFile("decisions/name.md", `${todayAnswerFixture()["decisions/name.md"]}\nThe release ships next week.\n`);
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Answer Name the next release", role: "dialog" })).toContain("Rejected: "));
		expect(roles.text({ name: "Answer Name the next release", role: "dialog" })).toContain("Source changed since review");
	},
);

screenStory.it(
	"records the option chosen in the Today popover and takes the row off Needs you",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ readResponses, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Pick a venue for the launch", role: "button" })).toBe("Answer"));
		yield* roles.click({ name: "Answer Pick a venue for the launch", role: "button" });
		yield* roles.click({ name: "Hall Choose hall.", role: "button" });
		yield* eventually(() => expect(roles.text({ name: "Needs you", role: "list" })).not.toContain("Pick a venue for the launch"));
		const saved = yield* Effect.promise(() => readResponses("decision.venue", "direction"));
		expect(saved.responses.map((entry) => entry.response.answers)).toEqual([[{ prompt: "venue", selected: ["hall"], text: "" }]]);
	},
);

screenStory.it(
	"shows a read-only Board's Today popover without form controls and says answering is turned off, without a CLI flag",
	[routedScreen(todayRowsFixture(), "/", { home: "home.md" })],
	function* ({ findElements, keyboard, roles }) {
		yield* eventually(() => expect(roles.text({ name: "Answer Where should the project documents live?", role: "button" })).toBe("Answer"));
		for (const title of ["Where should the project documents live?", "Question for reader"]) {
			yield* roles.click({ name: `Answer ${title}`, role: "button" });
			const dialog = roles.text({ name: `Answer ${title}`, role: "dialog" });
			expect(dialog).toContain("Answering is turned off on this Board.");
			expect(dialog).not.toContain("--responses");
			expect(dialog).not.toContain("Answer as");
			const controls = findElements("[role='dialog'] :is(a, button, input, textarea, select, summary)", document).map((control) =>
				roles.accessible(control),
			);
			expect(controls).toEqual([{ name: "Read the full question", role: "link" }]);
			keyboard("Escape");
			yield* eventually(() => expect(findElements("[role='dialog']", document)).toEqual([]));
		}
		yield* roles.click({ name: "Answer Where should the project documents live?", role: "button" });
		expect(roles.text({ name: "Answer Where should the project documents live?", role: "dialog" })).toContain("Keep local files · Recommended");
	},
);
