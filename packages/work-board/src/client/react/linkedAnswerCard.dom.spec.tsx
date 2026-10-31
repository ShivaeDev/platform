import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerCardFixture, decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const WRITABLE = { home: "home.md", writable: true };
const NOTE = "Please tighten the release instructions.";

for (const url of ["/guide.md", "/_board/item/task.guide/"]) {
	screenStory.it(
		`the task a decision unblocks shows the decision's answer card right below its header at ${url}`,
		[routedScreen(readyDecisionFixture, url, WRITABLE)],
		function* ({ cardReason, documentText, itemHeading, itemLayout }) {
			yield* outcomes({
				document: [documentText(), expect.stringContaining("Keep the release instructions clear.")],
				heading: [itemHeading(), "Publish the install guide"],
				layout: [itemLayout(), ["header", "answer cards", "document"]],
				reason: [cardReason(), expect.objectContaining({ paragraphs: [expect.stringContaining("Reviewed PR is ready to merge.")] })],
			});
		},
	);

	screenStory.it(
		`a note recorded on the task page at ${url} is saved against the decision, and the card says Fleet isn't running`,
		[routedScreen(readyDecisionFixture, url, WRITABLE)],
		function* ({ answeredNote, recordAnswer, recordedAnswers, writeAnswer }) {
			yield* writeAnswer(NOTE, "fleet-action");

			yield* recordAnswer();

			yield* outcomes({
				"card says": [answeredNote(), "You answered. Fleet isn't running. It picks this up when it starts again."],
				recorded: [
					recordedAnswers(decisionId, "direction"),
					[expect.objectContaining({ answers: [{ prompt: "fleet-action", selected: [], text: NOTE }], author: "maintainer" })],
				],
			});
		},
	);
}

screenStory.it(
	"the linked answer card shows its reason, recommendation, link, options, note box and Record answer, and keeps reply kind, preview and clear under a closed More options",
	[routedScreen(readyDecisionFixture, "/guide.md", WRITABLE)],
	function* ({ cardParts, moreOptions, moreOptionsState }) {
		yield* outcomes({
			"card shows": [cardParts(), ["title", "reason", "recommendation", "links", "options", "answer box", "Record answer", "More options"]],
			"inside More options": [
				moreOptions(),
				{ choices: ["Kind of reply: An answer (no is an answer too)"], text: expect.stringMatching(/Preview.*Clear draft/su) },
			],
			"More options": [moreOptionsState(), "closed"],
		});
	},
);

screenStory.it(
	"the task page offers the decision's authored options and lets the reader record",
	[routedScreen(answerCardFixture, "/guide.md", WRITABLE)],
	function* ({ cardOptions, recordButton }) {
		yield* outcomes({
			options: [
				cardOptions(),
				["Publish now (recommended): Ship the reviewed guide with this release.", "Wait for review: Keep the work blocked until another review."],
			],
			"Record answer": [recordButton(), "enabled"],
		});
	},
);

screenStory.it(
	"the task page drops the decision's answer card once its request closes",
	[
		routedScreen(
			{ ...answerCardFixture, [decisionFile]: (answerCardFixture[decisionFile] ?? "").replace('"state":"open"', '"state":"closed"') },
			"/guide.md",
			{ home: "home.md" },
		),
	],
	function* ({ cardTitle, documentText }) {
		yield* outcomes({
			"answer card": [cardTitle(), "no answer card"],
			document: [documentText(), expect.stringContaining("Keep the release instructions clear.")],
		});
	},
);
