import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayContextFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const SAVED = "#needs-you [role='status']";
const NEEDS = { name: "Needs you", role: "list" };
const COUNTS = ["#inbox-count", "#inbox-topbar-count", 'nav[aria-label="Phone navigation"] a[href="/"] [data-slot="badge"]'];
const ANSWERED = 1;

screenStory.it(
	"confirms a saved Today answer and takes its row off Needs you before the Board refresh arrives",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerRefreshStarted, findElements, holdRefreshAfterAnswer, readFocus, readResponses, readText, releaseRefreshAfterAnswer, roles }) {
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Answer Question for reader", role: "button" })).toBe("Answer")));
		const asked = findElements("#needs-you li").length;
		expect(COUNTS.map((selector) => readText(selector))).toEqual(COUNTS.map(() => String(asked)));
		holdRefreshAfterAnswer();
		yield* roles.click({ name: "Answer Question for reader", role: "button" });
		yield* roles.enter({ name: "Your answer", role: "textbox" }, "Publish the guide on Monday.");
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(answerRefreshStarted()).toBe(true)));
		yield* Effect.promise(() => eventually(() => expect(readText(SAVED)).toBe("Answer saved")));
		expect(findElements("[role='dialog']", document)).toEqual([]);
		expect(roles.text(NEEDS)).not.toContain("Question for reader");
		expect(readFocus()?.textContent).toBe("Needs you");
		const left = String(asked - ANSWERED);
		expect([String(findElements("#needs-you li").length), ...COUNTS.map((selector) => readText(selector))]).toEqual([left, left, left, left]);
		yield* Effect.promise(releaseRefreshAfterAnswer);
		yield* Effect.promise(() =>
			eventually(() => expect(roles.text({ name: "Answered, waiting for Fleet", role: "list" })).toContain("Question for reader")),
		);
		expect(roles.text(NEEDS)).not.toContain("Question for reader");
		expect(readFocus()?.textContent).toBe("Question for reader");
		expect(COUNTS.map((selector) => readText(selector))).toEqual([left, left, left]);
		const saved = yield* Effect.promise(() => readResponses("decision.reader", "direction"));
		expect(saved.responses.map((entry) => entry.body)).toEqual(["Publish the guide on Monday."]);
	},
);

screenStory.it(
	"says Saving your answer while the save runs",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ holdWorkspace, readText, releaseWorkspace, roles }) {
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Answer Question for reader", role: "button" })).toBe("Answer")));
		yield* roles.click({ name: "Answer Question for reader", role: "button" });
		yield* roles.enter({ name: "Your answer", role: "textbox" }, "Publish the guide on Monday.");
		holdWorkspace();
		yield* roles.click({ name: "Record answer", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(readText("[role='dialog'] [role='status']", document)).toBe("Saving your answer…")));
		yield* Effect.promise(releaseWorkspace);
		yield* Effect.promise(() => eventually(() => expect(readText(SAVED)).toBe("Answer saved")));
	},
);

screenStory.it(
	"turns off Today answers with a reason while the live connection is down",
	[routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true })],
	function* ({ dropLiveConnection, findElements, readText, roles }) {
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Answer Pick a venue for the launch", role: "button" })).toBe("Answer")));
		yield* Effect.promise(dropLiveConnection);
		yield* roles.click({ name: "Answer Pick a venue for the launch", role: "button" });
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText("[role='dialog'] [role='status']", document)).toBe("Reconnecting to the Board. You can answer once it is back."),
			),
		);
		const options = findElements("[role='dialog'] fieldset button:not([data-slot='collapsible-trigger'])", document);
		expect(options.map((button) => roles.accessible(button).name)).toEqual(["Hall Choose hall.", "Park Choose park."]);
		expect(options.map((button) => button.hasAttribute("disabled"))).toEqual([true, true]);
	},
);

screenStory.it(
	"shows the options and recommendation a text question lists in its body, labelled by its title",
	[routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true })],
	function* ({ findElement, roles }) {
		const dialog = { name: "Answer Keep the startup workaround?", role: "dialog" };
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Answer Keep the startup workaround?", role: "button" })).toBe("Answer")));
		yield* roles.click({ name: "Answer Keep the startup workaround?", role: "button" });
		expect(roles.accessible("[role='dialog'] fieldset")).toEqual({ name: "Answer for Keep the startup workaround?", role: "group" });
		const trigger = { name: "Options in the question (3)", role: "button" };
		expect(findElement("[role='dialog'] [data-slot='collapsible-trigger']", document)?.getAttribute("aria-expanded")).toBe("false");
		expect(roles.text(dialog)).not.toContain("Fix the environment");
		yield* roles.click(trigger);
		yield* Effect.promise(() => eventually(() => expect(roles.text(dialog)).toContain("B. Fix the environment.")));
		expect(roles.text(dialog)).toContain("A. Keep the workaround. · Recommended");
		expect(roles.text(dialog)).toContain("Publish a revision that activates on its own, then drop the workaround.");
		expect(roles.text(dialog)).toContain("C. Decide after the release.");
		expect(roles.text({ name: "Read the full question", role: "link" })).toBe("Read the full question");
	},
);

screenStory.it(
	"shows only the body's recommendation beside an options question's own choices",
	[routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true })],
	function* ({ roles }) {
		const dialog = { name: "Answer Pick the launch day", role: "dialog" };
		yield* Effect.promise(() => eventually(() => expect(roles.text({ name: "Answer Pick the launch day", role: "button" })).toBe("Answer")));
		yield* roles.click({ name: "Answer Pick the launch day", role: "button" });
		yield* roles.click({ name: "Recommendation in the question", role: "button" });
		yield* Effect.promise(() => eventually(() => expect(roles.text(dialog)).toContain("Monday, so the team can watch it.")));
		expect(roles.text(dialog)).not.toContain("Options in the question");
		expect(roles.text({ name: "Monday Choose monday.", role: "button" })).toContain("Choose monday.");
	},
);
