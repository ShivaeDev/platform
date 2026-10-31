import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayAnswerFixture, todayContextFixture } from "#test/todayRowsFixture.ts";

expectNoReactWarnings();

const READER = "Question for reader";
const ANSWER = "Publish the guide on Monday.";
const TODAY = routedScreen(todayAnswerFixture(), "/", { home: "home.md", writable: true });
const CONTEXT = routedScreen(todayContextFixture(), "/", { home: "home.md", writable: true });

screenStory.it(
	"recording a Today answer closes it, says Answer saved, takes the question off Needs you and lowers every Needs you count by one before the Board refresh arrives",
	[TODAY],
	function* ({ answerOnToday, holdRefreshAfterAnswer, needsYou, needsYouNotice, recordOnToday, todayAnswer, todayCounts, writeOnToday }) {
		const before = yield* todayCounts();
		yield* answerOnToday(READER);
		yield* writeOnToday(ANSWER);
		yield* holdRefreshAfterAnswer();

		yield* recordOnToday();

		const left = String(before["Needs you"] - 1);
		yield* outcomes({
			counts: [todayCounts(), { header: left, "Needs you": before["Needs you"] - 1, phone: left, sidebar: left }],
			"needs you": [needsYou(), expect.not.arrayContaining([READER])],
			notice: [needsYouNotice(), "Answer saved"],
			"Today answer": [todayAnswer(), "closed"],
		});
	},
);

screenStory.it(
	"after a Today answer is saved, keyboard focus waits on Needs you until the Board refresh arrives",
	[TODAY],
	function* ({ answerOnToday, focusedControl, holdRefreshAfterAnswer, recordOnToday, writeOnToday }) {
		yield* answerOnToday(READER);
		yield* writeOnToday(ANSWER);
		yield* holdRefreshAfterAnswer();

		yield* recordOnToday();

		expect(yield* focusedControl()).toEqual(expect.objectContaining({ name: "Needs you" }));
	},
);

screenStory.it(
	"when the Board refresh arrives after a Today answer, the question shows under Answered with focus on it, and the counts stay lowered",
	[TODAY],
	function* ({
		answerOnToday,
		answeredRows,
		focusedControl,
		holdRefreshAfterAnswer,
		needsYou,
		recordOnToday,
		releaseRefreshAfterAnswer,
		todayCounts,
		writeOnToday,
	}) {
		yield* answerOnToday(READER);
		yield* writeOnToday(ANSWER);
		yield* holdRefreshAfterAnswer();
		yield* recordOnToday();
		const saved = yield* todayCounts();

		yield* releaseRefreshAfterAnswer();

		yield* outcomes({
			answered: [answeredRows(), expect.arrayContaining([[READER, expect.any(String)]])],
			counts: [todayCounts(), saved],
			focus: [focusedControl(), expect.objectContaining({ name: READER })],
			"needs you": [needsYou(), expect.not.arrayContaining([READER])],
		});
	},
);

screenStory.it(
	"a Today answer records exactly what the reader typed",
	[TODAY],
	function* ({ answerOnToday, recordOnToday, recordedAnswers, writeOnToday }) {
		yield* answerOnToday(READER);
		yield* writeOnToday(ANSWER);

		yield* recordOnToday();

		expect(yield* recordedAnswers("decision.reader", "direction")).toEqual([expect.objectContaining({ body: ANSWER })]);
	},
);

screenStory.it(
	"while a Today answer saves, it says Saving your answer…",
	[TODAY],
	function* ({ answerOnToday, holdWorkspace, recordOnToday, todayAnswer, writeOnToday }) {
		yield* answerOnToday(READER);
		yield* writeOnToday(ANSWER);
		yield* holdWorkspace();

		yield* recordOnToday();

		expect(yield* todayAnswer()).toEqual(expect.objectContaining({ status: "Saving your answer…" }));
	},
);

screenStory.it(
	"while the live connection is down, a Today answer says it is reconnecting and its options can't be chosen",
	[TODAY],
	function* ({ answerOnToday, dropLiveConnection, todayAnswer, todayOptions }) {
		yield* dropLiveConnection();

		yield* answerOnToday("Pick a venue for the launch");

		yield* outcomes({
			options: [todayOptions(), ["Hall Choose hall. (disabled)", "Park Choose park. (disabled)"]],
			status: [todayAnswer(), expect.objectContaining({ status: "Reconnecting to the Board. You can answer once it is back." })],
		});
	},
);

screenStory.it(
	"a text question whose body lists options opens on Today labelled by its title, with those options collapsed",
	[CONTEXT],
	function* ({ answerOnToday, todayAnswerPanel }) {
		yield* answerOnToday("Keep the startup workaround?");

		expect(yield* todayAnswerPanel()).toEqual({
			group: "Answer for Keep the startup workaround?",
			order: ["answer box", "Options in the question (3) (collapsed)", "Read the full question"],
			text: expect.not.stringContaining("Fix the environment"),
		});
	},
);

screenStory.it(
	"expanding a text question's options on Today lists each option with its description and marks the recommended one",
	[CONTEXT],
	function* ({ answerOnToday, expandTodayContext, todayAnswerPanel }) {
		yield* answerOnToday("Keep the startup workaround?");

		yield* expandTodayContext();

		expect(yield* todayAnswerPanel()).toEqual(
			expect.objectContaining({
				text: expect.stringMatching(
					/A\. Keep the workaround\. · RecommendedClose the activation task as superseded\.B\. Fix the environment\.Publish a revision that activates on its own, then drop the workaround\.C\. Decide after the release\./su,
				),
			}),
		);
	},
);

screenStory.it(
	"an options question on Today offers its own choices and, expanded, only the body's recommendation",
	[CONTEXT],
	function* ({ answerOnToday, expandTodayContext, todayAnswerPanel, todayOptions }) {
		yield* answerOnToday("Pick the launch day");

		yield* expandTodayContext();

		yield* outcomes({
			options: [todayOptions(), expect.arrayContaining(["Monday Choose monday."])],
			panel: [
				todayAnswerPanel(),
				expect.objectContaining({
					order: expect.arrayContaining(["Recommendation in the question (expanded)"]),
					text: expect.stringMatching(/^(?!.*Options in the question).*Monday, so the team can watch it\./su),
				}),
			],
		});
	},
);
