import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayContextFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const READER = "Question for reader";
const VENUE = "Pick a venue for the launch";
const TODAY = routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true });
const PHONE = screenMedia(["(max-width: 767px)", "(any-pointer: coarse)"]);

screenStory.it(
	"what the reader typed in a Today answer is still there after Escape closes it and it opens again",
	[TODAY],
	function* ({ answerOnToday, closeTodayAnswer, todayAnswer, todayAnswerText, writeOnToday }) {
		yield* answerOnToday(READER);
		yield* writeOnToday("Publish the guide");
		yield* closeTodayAnswer();
		expect(yield* todayAnswer()).toBe("closed");

		yield* answerOnToday(READER);

		expect(yield* todayAnswerText()).toBe("Publish the guide");
	},
);

for (const [title, label, prompt, item] of [
	[READER, "Your answer", undefined, "/_board/item/decision.reader/"],
	["Name the next release", "What should the release be called?", "name", "/_board/item/decision.name/"],
] as const) {
	screenStory.it(
		`a draft started on Today for "${title}" is in the item page's answer box after following Read the full question`,
		[TODAY],
		function* ({ answerBoxState, answerOnToday, currentRoute, followFullQuestion, writeOnToday }) {
			yield* answerOnToday(title);
			yield* writeOnToday("Started on Today", label);

			yield* followFullQuestion();

			yield* outcomes([
				["draft", () => answerBoxState(prompt), expect.objectContaining({ text: "Started on Today" })],
				["page", () => currentRoute(), expect.stringMatching(new RegExp(`^${item}`, "u"))],
			]);
		},
	);

	screenStory.it(
		`a draft finished on the item page for "${title}" is in the Today answer when it opens again`,
		[TODAY],
		function* ({ answerOnToday, followFullQuestion, navigate, todayAnswerText, writeAnswer, writeOnToday }) {
			yield* answerOnToday(title);
			yield* writeOnToday("Started on Today", label);
			yield* followFullQuestion();
			yield* writeAnswer("Finished on the item page", prompt);
			yield* navigate("/");

			yield* answerOnToday(title);

			expect(yield* todayAnswerText(label)).toBe("Finished on the item page");
		},
	);
}

screenStory.it(
	"a Today answer for a text question puts keyboard focus in its text box, past the question's listed options",
	[routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, focusedControl, todayAnswerPanel }) {
		yield* answerOnToday("Keep the startup workaround?");

		yield* outcomes([
			["focus", () => focusedControl(), { name: "Your answer", role: "textbox" }],
			["panel", () => todayAnswerPanel(), expect.objectContaining({ order: expect.arrayContaining(["Options in the question (3) (collapsed)"]) })],
		]);
	},
);

screenStory.it(
	"a Today answer for an options question puts keyboard focus on its first option, past the question's recommendation",
	[routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, focusedControl, todayAnswerPanel }) {
		yield* answerOnToday("Pick the launch day");

		yield* outcomes([
			["focus", () => focusedControl(), { name: "Monday Choose monday.", role: "button" }],
			["panel", () => todayAnswerPanel(), expect.objectContaining({ order: expect.arrayContaining(["Recommendation in the question (collapsed)"]) })],
		]);
	},
);

screenStory.it(
	"on a phone, a Today answer opens as a bottom sheet named for its question and hides the phone navigation while it is open",
	[PHONE, TODAY],
	function* ({ answerOnToday, phoneNavigation, todayAnswer }) {
		expect(yield* phoneNavigation()).toBe("shown");

		yield* answerOnToday(READER);

		yield* outcomes([
			["phone navigation", () => phoneNavigation(), "hidden"],
			["Today answer", () => todayAnswer(), expect.objectContaining({ name: `Answer ${READER}`, shape: "bottom sheet" })],
		]);
	},
);

screenStory.it(
	"on a phone, closing a Today answer brings the phone navigation back",
	[PHONE, TODAY],
	function* ({ answerOnToday, closeTodayAnswer, phoneNavigation }) {
		yield* answerOnToday(READER);
		expect(yield* phoneNavigation()).toBe("hidden");

		yield* closeTodayAnswer();

		expect(yield* phoneNavigation()).toBe("shown");
	},
);

screenStory.it(
	"on a phone, recording from the bottom sheet saves the answer and takes the question off Needs you",
	[PHONE, TODAY],
	function* ({ answerOnToday, needsYou, recordOnToday, recordedAnswers, writeOnToday }) {
		yield* answerOnToday(READER);
		yield* writeOnToday("Publish the guide on Monday.");

		yield* recordOnToday();

		yield* outcomes([
			["needs you", () => needsYou(), expect.not.arrayContaining([READER])],
			["recorded", () => recordedAnswers("decision.reader", "direction"), [expect.objectContaining({ body: "Publish the guide on Monday." })]],
		]);
	},
);

screenStory.it(
	"an option chosen on Today is recorded with a single Recorded response heading and no empty overall response, as the item page writes it",
	[TODAY],
	function* ({ answerOnToday, chooseOnToday, recordedAnswers }) {
		yield* answerOnToday(VENUE);

		yield* chooseOnToday("Hall Choose hall.");

		expect(yield* recordedAnswers("decision.venue", "direction")).toEqual([
			expect.objectContaining({
				body: expect.stringMatching(
					/^(?![\s\S]*## Overall response)(?![\s\S]*# Recorded response[\s\S]*# Recorded response)[\s\S]*# Recorded response/u,
				),
			}),
		]);
	},
);

screenStory.it(
	"a note and reply kind left on the item page are named on Today before the reader chooses, with a link back to them",
	[TODAY],
	function* ({ answerOnToday, chooseInMoreOptions, navigate, todayHiddenDraft, writeAnswer }) {
		yield* navigate("/_board/item/decision.venue/");
		yield* writeAnswer("The hall has parking.", "venue");
		yield* writeAnswer("Check the date with the team.");
		yield* chooseInMoreOptions("Kind of reply", "A question back (it keeps waiting for you)");
		yield* navigate("/");

		yield* answerOnToday(VENUE);

		expect(yield* todayHiddenDraft()).toEqual({
			link: "/_board/item/decision.venue/#answer-card-direction",
			text: "Also sends your note, your reply kind, a question back from the item page. Review it on the item page",
		});
	},
);

screenStory.it(
	"choosing an option on Today records the item page's note, overall response and reply kind with it",
	[TODAY],
	function* ({ answerOnToday, chooseInMoreOptions, chooseOnToday, navigate, recordedAnswers, writeAnswer }) {
		yield* navigate("/_board/item/decision.venue/");
		yield* writeAnswer("The hall has parking.", "venue");
		yield* writeAnswer("Check the date with the team.");
		yield* chooseInMoreOptions("Kind of reply", "A question back (it keeps waiting for you)");
		yield* navigate("/");
		yield* answerOnToday(VENUE);

		yield* chooseOnToday("Hall Choose hall.");

		expect(yield* recordedAnswers("decision.venue", "direction")).toEqual([
			expect.objectContaining({
				answers: [{ prompt: "venue", selected: ["hall"], text: "The hall has parking." }],
				body: expect.stringContaining("## Overall response\n\nCheck the date with the team."),
				kind: "clarify",
			}),
		]);
	},
);

for (const [title, label, limit] of [
	["Name the next release", "What should the release be called?", 8192],
	[READER, "Your answer", 32_768],
] as const) {
	screenStory.it(
		`a Today answer to "${title}" accepts up to ${limit} characters, the most its response file takes`,
		[TODAY],
		function* ({ answerOnToday, todayAnswerLimit }) {
			yield* answerOnToday(title);

			expect(yield* todayAnswerLimit(label)).toBe(limit);
		},
	);
}

screenStory.it(
	"an earlier answer the item page chose to replace is named on Today, and recording on Today replaces it",
	[TODAY],
	function* ({
		answerOnToday,
		chooseInMoreOptions,
		navigate,
		recordAnswer,
		recordOnToday,
		recordedAnswers,
		todayHiddenDraft,
		writeAnswer,
		writeOnToday,
	}) {
		yield* navigate("/_board/item/decision.reader/");
		yield* writeAnswer("Ask me after the release.");
		yield* chooseInMoreOptions("Kind of reply", "Not now (it keeps waiting for you)");
		yield* recordAnswer();
		const [earlier] = yield* recordedAnswers("decision.reader", "direction");
		yield* chooseInMoreOptions("Replace an earlier answer?", "Yes, replace your answer");
		yield* navigate("/");
		yield* answerOnToday(READER);
		expect(yield* todayHiddenDraft()).toEqual(
			expect.objectContaining({ text: "Also sends the earlier answer it replaces from the item page. Review it on the item page" }),
		);
		yield* writeOnToday("Publish the guide on Monday.");

		yield* recordOnToday();

		expect(yield* recordedAnswers("decision.reader", "direction")).toEqual(
			expect.arrayContaining([expect.objectContaining({ body: "Publish the guide on Monday.", replaces: earlier?.id })]),
		);
	},
);
