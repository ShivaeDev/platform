import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { ANSWERED_TASK, answeredDecisionFixture, guideFleet } from "#test/answeredDecisionFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { screenFleet } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const url = `/_board/item/${decisionId}/`;
const TITLE = "Publish the install guide";
const QUESTION = "Do you want changes before merging?";
const NEXT_PASS = "Fleet picks this up on its next pass.";
const FLEET_DOWN = "Fleet isn't running. It picks this up when it starts again.";
const REQUEST_CHANGES =
	"Request changes Write the changes in your answer. The worker makes them on the same branch and PR, then Fleet reviews and checks the PR again.";
const OPEN_ASK = {
	"ask.md": `---\n${JSON.stringify({
		attention: [
			{ id: "scope", kind: "decision", reason: "Confirm the guide scope", "response_from": ["maintainer"], state: "open", unblocks: ["task.guide"] },
		],
		id: "decision.scope",
		kind: "question",
		scope: "task",
		urgency: "whenever",
	})}\n---\n# Scope for the install guide\n`,
};
const unanswered = { ...readyDecisionFixture, "guide.md": ANSWERED_TASK };

screenStory.it(
	"an answered Fleet decision leaves Needs you and waits under Answered, saying Fleet picks it up on its next pass",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ answeredRows, needsYou, todaySummary }) {
		yield* outcomes([
			["answered", () => answeredRows(), [[TITLE, `${QUESTION} · You chose Request changes · ${NEXT_PASS}`]]],
			["needs you", () => needsYou(), "Nothing needs you"],
			["summary", () => todaySummary(), expect.stringMatching(/^0 need you/u)],
		]);
	},
);

screenStory.it(
	"Fleet's receipt for an answer older than a week takes it off Answered",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ answeredRows, fleetAppliesAnswer, needsYou, refreshInbox }) {
		expect(yield* answeredRows()).toEqual([[TITLE, expect.any(String)]]);
		yield* fleetAppliesAnswer();

		yield* refreshInbox();

		yield* outcomes([
			["answered", () => answeredRows(), []],
			["needs you", () => needsYou(), "Nothing needs you"],
		]);
	},
);

screenStory.it(
	"while Fleet is not running, Today says an answer waits for Fleet to start again",
	[routedScreen(answeredDecisionFixture(), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		expect(yield* answeredRows()).toEqual([[TITLE, `${QUESTION} · You chose Request changes · ${FLEET_DOWN}`]]);
	},
);

screenStory.it(
	"Today names the agent that answered instead of the reader",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture("orchestrator"), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		expect(yield* answeredRows()).toEqual([[TITLE, `${QUESTION} · orchestrator chose Request changes · ${NEXT_PASS}`]]);
	},
);

for (const [fleet, copy] of [
	[true, NEXT_PASS],
	[false, FLEET_DOWN],
] as const) {
	screenStory.it(
		`an answered item waits on automation on Now, saying ${fleet ? "Fleet picks it up on its next pass" : "Fleet isn't running"}`,
		[...(fleet ? [screenFleet(guideFleet)] : []), routedScreen(answeredDecisionFixture(), "/_board/work", { home: "home.md" })],
		function* ({ workCard }) {
			expect(yield* workCard("task.guide")).toEqual({
				answer: `You answered: Request changes. ${copy}`,
				lane: "Waiting on automation",
				owner: "Waiting for Fleet",
				status: "Waiting on automation",
			});
		},
	);
}

screenStory.it(
	"an answered item stays waiting on you on Now while another ask on it is open",
	[screenFleet(guideFleet), routedScreen({ ...answeredDecisionFixture(), ...OPEN_ASK }, "/_board/work", { home: "home.md" })],
	function* ({ workCard }) {
		expect(yield* workCard("task.guide")).toEqual({ answer: "none", lane: "Waiting on you", owner: "Waiting on your answer", status: "Needs you" });
	},
);

screenStory.it(
	"choosing an option in the Today answer moves the decision from Needs you to Answered and keeps focus on its row",
	[screenFleet(guideFleet), routedScreen(unanswered, "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, answeredRows, chooseOnToday, focusedControl, needsYou }) {
		expect(yield* needsYou()).toEqual([TITLE]);
		yield* answerOnToday(TITLE);

		yield* chooseOnToday(REQUEST_CHANGES);

		yield* outcomes([
			["answered", () => answeredRows(), [[TITLE, `${QUESTION} · You chose Request changes · ${NEXT_PASS}`]]],
			["focus", () => focusedControl(), { name: TITLE, role: "link" }],
			["needs you", () => needsYou(), "Nothing needs you"],
		]);
	},
);

screenStory.it(
	"an answer given on Today says Fleet applied it once Fleet's receipt arrives",
	[screenFleet(guideFleet), routedScreen(unanswered, "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, answeredRows, chooseOnToday, fleetAppliesAnswer, recordedAnswers, refreshInbox }) {
		yield* answerOnToday(TITLE);
		yield* chooseOnToday(REQUEST_CHANGES);
		const [answer] = yield* recordedAnswers(decisionId, "direction");
		yield* fleetAppliesAnswer(answer?.id);

		yield* refreshInbox();

		expect(yield* answeredRows()).toEqual([[TITLE, `${QUESTION} · You chose Request changes · Fleet applied it.`]]);
	},
);

screenStory.it(
	"recording an answer on the item page retitles the card Answered, says Fleet picks it up on its next pass and moves focus to that note",
	[screenFleet(guideFleet), routedScreen(unanswered, url, { home: "home.md", writable: true })],
	function* ({ answeredNote, cardTitle, chooseAnswer, focusedControl, recordAnswer }) {
		expect(yield* cardTitle()).toBe(`Answer: ${TITLE}`);
		yield* chooseAnswer("retry");

		yield* recordAnswer();

		yield* outcomes([
			["focus", () => focusedControl(), { role: "status", text: `You answered: Request changes. ${NEXT_PASS}` }],
			["note", () => answeredNote(), `You answered: Request changes. ${NEXT_PASS}`],
			["title", () => cardTitle(), `Answered: ${TITLE}`],
		]);
	},
);

screenStory.it(
	"once answered, the item waits on automation and its card lists the choice with the form folded under Change answer",
	[screenFleet(guideFleet), routedScreen(unanswered, url, { home: "home.md", writable: true })],
	function* ({ answerHistory, changeAnswer, chooseAnswer, itemStatus, recordAnswer }) {
		yield* chooseAnswer("retry");

		yield* recordAnswer();

		yield* outcomes([
			["answers so far", () => answerHistory(), ["Request changes"]],
			["change answer", () => changeAnswer(), expect.objectContaining({ state: "closed" })],
			["status", () => itemStatus(), "Waiting on automation"],
		]);
	},
);

screenStory.it(
	"Fleet's receipt for the answer removes the answer card from the item page",
	[screenFleet(guideFleet), routedScreen(unanswered, url, { home: "home.md", writable: true })],
	function* ({ cardTitle, chooseAnswer, fleetAppliesAnswer, recordAnswer, recordedAnswers, refreshDocument }) {
		yield* chooseAnswer("retry");
		yield* recordAnswer();
		const [answer] = yield* recordedAnswers(decisionId, "direction");
		yield* fleetAppliesAnswer(answer?.id);

		yield* refreshDocument(url);

		expect(yield* cardTitle()).toBe("no answer card");
	},
);

screenStory.it(
	"changing an answer starts with no option chosen and records the new choice as replacing the earlier answer",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture(), url, { home: "home.md", writable: true })],
	function* ({ answeredNote, changeAnswer, chooseAnswer, openChangeAnswer, recordAnswer, recordedAnswers }) {
		yield* openChangeAnswer();
		expect(yield* changeAnswer()).toEqual({ chosen: [], replaces: "response.direction-retry", state: "open" });
		yield* chooseAnswer("release");

		yield* recordAnswer();

		yield* outcomes([
			["note", () => answeredNote(), `You answered: Stop and hand back. ${NEXT_PASS}`],
			[
				"recorded",
				() => recordedAnswers(decisionId, "direction"),
				expect.arrayContaining([expect.objectContaining({ replaces: "response.direction-retry" })]),
			],
		]);
	},
);

screenStory.it(
	"an answer someone else recorded names them on the item's answer card",
	[screenFleet(guideFleet), routedScreen(answeredDecisionFixture("orchestrator"), url, { home: "home.md", writable: true })],
	function* ({ answeredNote }) {
		expect(yield* answeredNote()).toBe(`Answered by orchestrator: Request changes. ${NEXT_PASS}`);
	},
);
