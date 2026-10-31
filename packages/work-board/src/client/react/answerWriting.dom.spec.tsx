import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerCardFixture, decisionId, TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const WRITABLE = { home: "home.md", writable: true };
const questionUrl = `/_board/item/${TEXT_QUESTION_ID}/`;
const decisionUrl = `/_board/item/${decisionId}/`;
const DRAFT = "Share one pool per worker.\n\nCap it at ten connections.";
const CLOSED_QUESTION = textQuestionFixture["question.md"].replace("status: ready", "status: done");
const question = routedScreen(textQuestionFixture, questionUrl, WRITABLE);

screenStory.it(
	"a question closed while the reader writes leaves a read-only closed draft that says why, in place of the answer form",
	[question],
	function* ({ closedDraft, editFile, recordButton, refreshDocument, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* editFile("question.md", CLOSED_QUESTION);

		yield* refreshDocument(questionUrl);

		yield* outcomes({
			"closed draft": [
				closedDraft(),
				{
					notice: "Its file now marks the question done. Your draft was not sent.",
					text: DRAFT,
					textEditable: false,
					title: "Closed while you were writing: Pooling design for the scale tests",
				},
			],
			"Record answer": [recordButton(), "missing"],
		});
	},
);

screenStory.it(
	"Copy draft puts the unsent draft on the clipboard and says Copied",
	[question],
	function* ({ clipboardText, closedDraftCopy, copyClosedDraft, editFile, refreshDocument, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* editFile("question.md", CLOSED_QUESTION);
		yield* refreshDocument(questionUrl);

		yield* copyClosedDraft();

		yield* outcomes({
			clipboard: [clipboardText(), DRAFT],
			status: [closedDraftCopy(), expect.objectContaining({ status: "Copied." })],
		});
	},
);

screenStory.it(
	"an untouched answer card goes away quietly when its question closes",
	[question],
	function* ({ cardTitle, closedDraft, editFile, refreshDocument }) {
		expect(yield* cardTitle()).toBe("Answer: Pooling design for the scale tests");
		yield* editFile("question.md", CLOSED_QUESTION);

		yield* refreshDocument(questionUrl);

		yield* outcomes({
			"answer card": [cardTitle(), "no answer card"],
			"closed draft": [closedDraft(), "none"],
		});
	},
);

screenStory.it("a written question shows its own text above its answer card", [question], function* ({ documentText, itemLayout }) {
	yield* outcomes({
		document: [documentText(), expect.stringContaining("Write the design in your answer")],
		layout: [itemLayout(), ["header", "document", "answer cards"]],
	});
});

screenStory.it(
	"a Today ask that opens a choice question puts focus on its first option",
	[routedScreen(answerCardFixture, "/", WRITABLE)],
	function* ({ focusedControl, openTodayAsk }) {
		yield* openTodayAsk("Publish the install guide");

		expect(yield* focusedControl()).toEqual({ name: "Publish now Recommended", role: "radio" });
	},
);

screenStory.it(
	"an Answer link to a written question puts focus in its answer box",
	[routedScreen(textQuestionFixture, "/", WRITABLE)],
	function* ({ focusedControl, followAnswerLink }) {
		yield* followAnswerLink(`${questionUrl}#answer-card-answer`);

		expect(yield* focusedControl()).toEqual({ name: "Your answer", role: "textbox" });
	},
);

screenStory.it(
	"following the Answer link again leaves focus in the answer box where the reader writes",
	[routedScreen(answerCardFixture, decisionUrl, WRITABLE)],
	function* ({ focusAnswerBox, focusedControl, followAnswerLink }) {
		yield* focusAnswerBox();

		yield* followAnswerLink(`${decisionUrl}#answer-card-direction`);

		expect(yield* focusedControl()).toEqual({ name: "Anything else to add (optional)", role: "textbox" });
	},
);

screenStory.it(
	"More options on an answered decision speaks plainly, without author labels, kinds or file paths",
	[routedScreen(answeredDecisionFixture(), decisionUrl, WRITABLE)],
	function* ({ moreOptions, openChangeAnswer, openMoreOptions }) {
		yield* openChangeAnswer();

		yield* openMoreOptions();

		expect(yield* moreOptions()).toEqual({
			choices: ["Kind of reply: An answer (no is an answer too)", "Replace an earlier answer?: Yes, replace your answer: Request changes"],
			text: expect.stringMatching(
				/^(?!.*(?:author label|maintainer|Response kind|Supersedes|supersede|KiB|responses\/)).*This browser keeps your draft for seven days after your last edit\./su,
			),
		});
	},
);
