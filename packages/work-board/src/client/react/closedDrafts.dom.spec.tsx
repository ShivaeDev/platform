import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { answerCardFixture, decisionFile, decisionId } from "#test/answerCardFixture.ts";
import { deniedClipboard, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const decisionUrl = `/_board/item/${decisionId}/`;
const DRAFT = "Publish after the release notes are reviewed.";
const decision = answerCardFixture[decisionFile] ?? "";
const closedRequest = decision.replace('"state":"open"', '"state":"closed"');
const withdrawnRequest = decision.replace(/"attention":\[[\s\S]*?\],"id"/u, '"id"').replace('"kind":"question"', '"kind":"task"');

const CLOSINGS = [
	{
		name: "says a closed request closed the card when its file closes the request",
		reason: "Its file now marks this request closed.",
		source: closedRequest,
		workspace: "closed-request",
	},
	{
		name: "says the file stopped asking when the request leaves its file",
		reason: "Its file no longer asks for an answer.",
		source: withdrawnRequest,
		workspace: "withdrawn-request",
	},
];

for (const closing of CLOSINGS) {
	screenStory.it(
		closing.name,
		[screenWorkspace(closing.workspace), routedScreen(answerCardFixture, decisionUrl, { home: "home.md", writable: true })],
		function* ({ answerInput, editFile, findElement, readText, refreshDocument }) {
			yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
			answerInput("body", DRAFT);
			editFile(decisionFile, closing.source);
			yield* Effect.promise(() => refreshDocument(decisionUrl));
			yield* eventually(() => expect(findElement("[data-closed-draft]")).not.toBeNull());
			expect(readText("[data-closed-draft] p[role='status']:not([data-copy-status])")).toBe(`${closing.reason} Your draft was not sent.`);
			expect(findElement<HTMLTextAreaElement>("[data-closed-draft] textarea")?.value).toBe(DRAFT);
		},
	);
}

screenStory.it(
	"selects the unsent draft for a manual copy when the clipboard refuses it",
	[deniedClipboard(), screenWorkspace("closed-copy"), routedScreen(answerCardFixture, decisionUrl, { home: "home.md", writable: true })],
	function* ({ answerInput, click, editFile, findElement, readFocus, readText, refreshDocument }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		answerInput("body", DRAFT);
		editFile(decisionFile, closedRequest);
		yield* Effect.promise(() => refreshDocument(decisionUrl));
		yield* eventually(() => expect(findElement("[data-closed-draft]")).not.toBeNull());
		click("[data-closed-draft] button");
		yield* eventually(() =>
			expect(readText("[data-closed-draft] [data-copy-status]")).toBe("Couldn't copy automatically. The draft is selected, so copy it yourself."),
		);
		const draft = findElement<HTMLTextAreaElement>("[data-closed-draft] textarea");
		expect(readFocus()).toBe(draft);
		expect([draft?.selectionStart, draft?.selectionEnd]).toEqual([0, DRAFT.length]);
	},
);
