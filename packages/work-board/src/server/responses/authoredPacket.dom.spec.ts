import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const withAuthoredMarkup = questionnaireSource.replace(
	"### How should replies appear?",
	'### How should replies appear?\n\n<form id="forged"><input name="author"></form>\n\n<script>globalThis.authoredPacketRan = true</script>\n',
);
const ITEM = "/_board/item/investigation.choices/";

screenStory.it(
	"a question's authored form and script markup neither reaches the live answer form nor runs",
	[routedScreen({ "proposal.md": withAuthoredMarkup }, ITEM, { home: undefined, writable: true })],
	function* ({ foreignPacketMarkup }) {
		expect(yield* foreignPacketMarkup()).toEqual([]);
	},
);

screenStory.it(
	"an authored author field in the question does not replace the remembered author on the saved answer",
	[
		screenWorkspace("authored-packet"),
		storedScreenState({ "work-board:author:authored-packet": "Reviewer" }),
		routedScreen({ "proposal.md": withAuthoredMarkup }, ITEM, { home: undefined, writable: true }),
	],
	function* ({ answerPrompt, recordedPacketAuthors, sendPacket }) {
		yield* answerPrompt("display", "Keep the history.");
		yield* answerPrompt("checks", "Test keyboard use.");

		yield* sendPacket();

		expect(yield* recordedPacketAuthors("investigation.choices", "direction")).toEqual(["Reviewer"]);
	},
);
