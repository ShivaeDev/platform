import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenMedia } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayLongQuestionFixture } from "#test/todayLongQuestionFixture.ts";

expectNoReactWarnings();

const TITLE = "Plan the release";
const QUESTION = "When should we release?";
const HISTORY = "The release has a long history";

for (const device of ["desktop", "phone"] as const) {
	const media = screenMedia(device === "phone" ? ["(max-width: 767px)", "(any-pointer: coarse)"] : []);
	for (const [mode, answers] of [
		["text", "answer box"],
		["one", "options"],
	] as const) {
		const fixture = routedScreen(todayLongQuestionFixture(mode), "/", { home: "home.md", writable: true });

		screenStory.it(
			`on ${device}, a long question with ${answers} opens on Today with its ${answers} first, its context collapsed below them, and a link to the full question`,
			[media, fixture],
			function* ({ answerOnToday, todayAnswerPanel }) {
				yield* answerOnToday(TITLE);

				expect(yield* todayAnswerPanel()).toEqual(
					expect.objectContaining({
						order: [answers, "Item context (collapsed)", "Read the full question"],
						text: expect.stringMatching(/^(?!.*The release has a long history).*When should we release\?/su),
					}),
				);
			},
		);

		screenStory.it(
			`on ${device}, answering a long question with ${answers} on Today records the answer and closes the Today answer`,
			[media, fixture],
			function* ({ answerOnToday, chooseOnToday, recordOnToday, recordedAnswers, todayAnswer, writeOnToday }) {
				yield* answerOnToday(TITLE);

				if (mode === "text") {
					yield* writeOnToday("Monday after review.", QUESTION);
					yield* recordOnToday();
				} else {
					yield* chooseOnToday("Monday The team is available.");
				}

				const answer = { prompt: "release", selected: mode === "one" ? ["monday"] : [], text: mode === "text" ? "Monday after review." : "" };
				yield* outcomes({
					recorded: [recordedAnswers("decision.release", "direction"), [expect.objectContaining({ answers: [answer] })]],
					"Today answer": [todayAnswer(), "closed"],
				});
			},
		);
	}
}

screenStory.it(
	"expanding Item context in a Today answer shows the question's longer context",
	[routedScreen(todayLongQuestionFixture("text"), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, expandTodayContext, todayAnswerPanel }) {
		yield* answerOnToday(TITLE);
		expect(yield* todayAnswerPanel()).toEqual(expect.objectContaining({ text: expect.not.stringContaining(HISTORY) }));

		yield* expandTodayContext();

		expect(yield* todayAnswerPanel()).toEqual(
			expect.objectContaining({ order: expect.arrayContaining(["Item context (expanded)"]), text: expect.stringContaining(HISTORY) }),
		);
	},
);
