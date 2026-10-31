import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { answerCardFixture, decisionFile, decisionId } from "#test/answerCardFixture.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const url = `/_board/item/${decisionId}/`;
const DRAFT = "Publish after the release notes are reviewed.";
const decision = answerCardFixture[decisionFile] ?? "";
const decisionPage = routedScreen(answerCardFixture, url, { home: "home.md", writable: true });

const CLOSINGS = [
	{ change: "closes the request", reason: "Its file now marks this request closed.", source: decision.replace('"state":"open"', '"state":"closed"') },
	{
		change: "stops asking",
		reason: "Its file no longer asks for an answer.",
		source: decision.replace(/"attention":\[[\s\S]*?\],"id"/u, '"id"').replace('"kind":"question"', '"kind":"task"'),
	},
];

for (const closing of CLOSINGS) {
	screenStory.it(
		`a draft whose decision file ${closing.change} becomes a closed draft that says so and keeps the unsent text`,
		[decisionPage],
		function* ({ closedDraft, editFile, refreshDocument, writeAnswer }) {
			yield* writeAnswer(DRAFT);
			yield* editFile(decisionFile, closing.source);

			yield* refreshDocument(url);

			expect(yield* closedDraft()).toEqual(expect.objectContaining({ notice: `${closing.reason} Your draft was not sent.`, text: DRAFT }));
		},
	);
}

screenStory.it(
	"when the clipboard refuses, Copy draft selects the whole unsent draft and asks the reader to copy it",
	[deniedClipboard(), decisionPage],
	function* ({ closedDraftCopy, copyClosedDraft, editFile, refreshDocument, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* editFile(decisionFile, CLOSINGS[0]?.source ?? "");
		yield* refreshDocument(url);

		yield* copyClosedDraft();

		expect(yield* closedDraftCopy()).toEqual({
			focused: true,
			selection: [0, DRAFT.length],
			status: "Couldn't copy automatically. The draft is selected, so copy it yourself.",
		});
	},
);
