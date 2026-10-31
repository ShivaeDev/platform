import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	answerCardFixture,
	DECISION_REASON,
	decisionId,
	paragraphDecisionFixture,
	readyDecisionFixture,
	withDecision,
} from "#test/answerCardFixture.ts";
import { answerAuthor } from "#test/answerTraits.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { WIDE_TABLE, WIDE_TABLE_LAYOUT } from "#test/wideTableFixture.ts";

expectNoReactWarnings();

const url = `/_board/item/${decisionId}/`;
const WRITABLE = { home: "home.md", writable: true };
const TITLE = "Fleet decision: Publish the install guide";

const REASONS = [
	{ files: answerCardFixture, mode: "fenced" },
	{ files: withDecision(answerCardFixture, (source) => source.replace(DECISION_REASON, `~~~~\n${DECISION_REASON}\n~~~~`)), mode: "nested fenced" },
	{ files: paragraphDecisionFixture, mode: "paragraph" },
];
const manyChoices = withDecision(readyDecisionFixture, (source) => source.replace('select="one"', 'select="many"'));

screenStory.it(
	"a managed decision is named after the item it unblocks, and its generated id shows nowhere",
	[routedScreen(answerCardFixture, url, WRITABLE)],
	function* ({ fileLocation, itemHeading, shownGeneratedIds }) {
		yield* outcomes([
			["generated ids shown", () => shownGeneratedIds(), []],
			["heading", () => itemHeading(), TITLE],
			["location", () => fileLocation(), expect.stringContaining(TITLE)],
		]);
	},
);

for (const { files, mode } of REASONS) {
	screenStory.it(
		`a decision's ${mode} reason shows once, in the answer card right below the item's header`,
		[routedScreen(files, url, WRITABLE)],
		function* ({ cardReason, cardTitle, documentText, itemLayout }) {
			yield* outcomes([
				["card title", () => cardTitle(), "Answer: Publish the install guide"],
				["document", () => documentText(), expect.not.stringContaining("Which publishing path")],
				["layout", () => itemLayout(), ["header", "answer cards", "document"]],
				[
					"reason",
					() => cardReason(),
					{
						links: ["https://example.com/releases"],
						paragraphs: expect.arrayContaining([expect.stringContaining("Which publishing path should we take?")]),
					},
				],
			]);
		},
	);
}

screenStory.it(
	"a decision's paragraph reason moves to the card while the background and conclusion around it stay in the document",
	[routedScreen(paragraphDecisionFixture, url, WRITABLE)],
	function* ({ cardReason, documentText }) {
		yield* outcomes([
			[
				"document",
				() => documentText(),
				expect.stringMatching(
					/^(?!.*Read the release guide).*Preserve this background before the decision\..*Preserve this conclusion after the decision\./su,
				),
			],
			[
				"reason",
				() => cardReason(),
				{ links: ["https://example.com/releases"], paragraphs: ["Which publishing path should we take?", "Read the release guide."] },
			],
		]);
	},
);

screenStory.it(
	"a decision lists its authored options and marks the recommended one",
	[routedScreen(answerCardFixture, url, WRITABLE)],
	function* ({ cardOptions }) {
		expect(yield* cardOptions()).toEqual([
			"Publish now (recommended): Ship the reviewed guide with this release.",
			"Wait for review: Keep the work blocked until another review.",
		]);
	},
);

screenStory.it(
	"a chosen option and a written note survive a refresh of the decision, with focus and selection where they were",
	[routedScreen(answerCardFixture, url, WRITABLE)],
	function* ({ answerBoxState, chooseAnswer, chosenOptions, refreshDocument, selectInAnswer, writeAnswer }) {
		yield* chooseAnswer("option-1");
		yield* writeAnswer("Use the reviewed version.", "answer");
		yield* selectInAnswer(4, 7, "answer");

		yield* refreshDocument(url);

		yield* outcomes([
			["chosen", () => chosenOptions(), ["option-1"]],
			["note", () => answerBoxState("answer"), { focused: true, selection: [4, 7], text: "Use the reviewed version." }],
		]);
	},
);

screenStory.it(
	"recording an answer saves the chosen option and note under the browser's remembered author, and the card says who answered",
	[answerAuthor("answer-card-fixture", "Reviewer"), routedScreen(answerCardFixture, url, WRITABLE)],
	function* ({ answeredNote, chooseAnswer, recordAnswer, recordedAnswers, writeAnswer }) {
		yield* chooseAnswer("option-1");
		yield* writeAnswer("Use the reviewed version.", "answer");

		yield* recordAnswer();

		yield* outcomes([
			["card says", () => answeredNote(), "Answered by Reviewer: Publish now. Fleet isn't running. It picks this up when it starts again."],
			[
				"recorded",
				() => recordedAnswers(decisionId, "direction"),
				[expect.objectContaining({ answers: [{ prompt: "answer", selected: ["option-1"], text: "Use the reviewed version." }], author: "Reviewer" })],
			],
		]);
	},
);

screenStory.it(
	"a Today ask on a read-only Board opens the decision at its answer card and focuses the card",
	[routedScreen(answerCardFixture, "/")],
	function* ({ currentRoute, focusedControl, openTodayAsk, todayAskHref }) {
		expect(yield* todayAskHref("Publish the install guide")).toBe(`${url}#answer-card-direction`);

		yield* openTodayAsk("Publish the install guide");

		yield* outcomes([
			["focus", () => focusedControl(), { name: "Answer: Publish the install guide", role: "region" }],
			["route", () => currentRoute(), `${url}#answer-card-direction`],
		]);
	},
);

screenStory.it(
	"a malformed open question says its answer is unavailable while its header still says it needs you",
	[
		routedScreen(
			{
				"home.md": "# Home",
				"question.md":
					"---\nid: question.invalid\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\noptions:\n - label: ''\n   description: Invalid choice\n---\n# Choose a direction\n",
			},
			"/_board/item/question.invalid/",
		),
	],
	function* ({ cardTitle, itemStatus }) {
		yield* outcomes([
			["card title", () => cardTitle(), "Answer unavailable"],
			["item status", () => itemStatus(), "Needs you"],
		]);
	},
);

screenStory.it(
	"a ready decision puts its recommendation and primary PR link above the choices, and keeps the recommendation out of the document",
	[routedScreen(readyDecisionFixture, url, WRITABLE)],
	function* ({ cardLinks, cardParts, cardRecommendation, documentText }) {
		yield* outcomes([
			["document", () => documentText(), expect.not.stringContaining("Merge the reviewed PR on GitHub.")],
			["links", () => cardLinks(), [{ href: "https://github.com/ShivaeDev/platform/pull/395", name: "Open PR #395", primary: true }]],
			["parts", () => cardParts(), ["title", "reason", "recommendation", "links", "options", "answer box", "Record answer", "More options"]],
			["recommendation", () => cardRecommendation(), "Merge the reviewed PR on GitHub."],
		]);
	},
);

screenStory.it("an open Fleet decision's header says it needs you", [routedScreen(readyDecisionFixture, url, WRITABLE)], function* ({ itemStatus }) {
	expect(yield* itemStatus()).toBe("Needs you");
});

for (const [heading, label] of [
	["### Release ownership", "Release ownership"],
	["", "Release"],
] as const) {
	screenStory.it(
		`an option ${heading ? "is named by its own heading" : "without a heading is named by its capitalised id"}`,
		[
			routedScreen(
				withDecision(readyDecisionFixture, (source) => source.replace("### Stop and hand back", heading)),
				url,
				WRITABLE,
			),
		],
		function* ({ cardOptions }) {
			expect(yield* cardOptions()).toEqual([expect.stringMatching(/^Request changes: /u), expect.stringMatching(new RegExp(`^${label}: `, "u"))]);
		},
	);
}

screenStory.it(
	"a question that allows several choices offers checkboxes that toggle on and off",
	[routedScreen(manyChoices, url, WRITABLE)],
	function* ({ chooseAnswer, chosenOptions, optionControls }) {
		expect(yield* optionControls()).toEqual(["retry: checkbox, tab stop", "release: checkbox, tab stop"]);

		yield* chooseAnswer("retry");

		expect(yield* chosenOptions()).toEqual(["retry"]);

		yield* chooseAnswer("retry");

		expect(yield* chosenOptions()).toEqual([]);
	},
);

screenStory.it(
	"a single-choice question is one Tab stop whose arrow keys move the choice, and Record answer saves the option chosen by keyboard",
	[routedScreen(readyDecisionFixture, url, WRITABLE)],
	function* ({ chosenOptions, focusOption, focusedControl, optionControls, pressKey, recordAnswer, recordedAnswers }) {
		expect(yield* optionControls()).toEqual(["retry: radio, tab stop", "release: radio, skipped by Tab"]);
		yield* focusOption("retry");

		yield* pressKey("ArrowDown");

		yield* outcomes([
			["chosen", () => chosenOptions(), ["release"]],
			["focus", () => focusedControl(), { name: "Stop and hand back", role: "radio" }],
		]);

		yield* recordAnswer();

		expect((yield* recordedAnswers(decisionId, "direction")).map(({ answers }) => answers)).toEqual([
			[{ prompt: "fleet-action", selected: ["release"], text: "" }],
		]);
	},
);

screenStory.it(
	"Space toggles each option of a many-choice question, and the answer records them in the order the reader chose them",
	[routedScreen(manyChoices, url, WRITABLE)],
	function* ({ chosenOptions, focusOption, pressKey, recordAnswer, recordedAnswers }) {
		yield* focusOption("release");
		yield* pressKey(" ");
		yield* focusOption("retry");
		yield* pressKey(" ");

		expect(yield* chosenOptions()).toEqual(["retry", "release"]);

		yield* recordAnswer();

		expect((yield* recordedAnswers(decisionId, "direction")).map(({ answers }) => answers)).toEqual([
			[{ prompt: "fleet-action", selected: ["release", "retry"], text: "" }],
		]);
	},
);

screenStory.it(
	"a wide table in an answer card's recommendation scrolls inside its own box like a document table",
	[
		routedScreen(
			withDecision(answerCardFixture, (source) =>
				source.replace("**Publish** the reviewed guide.", `**Publish** the reviewed guide.\n\n${WIDE_TABLE}`),
			),
			url,
			WRITABLE,
		),
	],
	function* ({ readTableLayout }) {
		expect(yield* readTableLayout(".answer-recommendation table")).toEqual(WIDE_TABLE_LAYOUT);
	},
);
