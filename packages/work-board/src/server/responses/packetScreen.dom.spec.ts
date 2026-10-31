import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const ITEM = "/_board/item/investigation.choices/";
const readOnly = { home: undefined, writable: false };
const writable = { home: undefined, writable: true };
const secondRequestClosed = scopedQuestionnaire.replace("kind: review\n    state: open", "kind: review\n    state: closed");

screenStory.it(
	"a read-only Board lists the packet's questions without any control and says answering is turned off",
	[routedScreen({ "proposal.md": questionnaireSource }, ITEM, readOnly)],
	function* ({ packetControls, packetNotice, packetPrompts }) {
		yield* outcomes({
			controls: [packetControls("direction"), []],
			notice: [packetNotice("direction"), ["Answering is turned off on this Board."]],
			questions: [packetPrompts("direction"), ["How should replies appear?", "Which checks matter?"]],
		});
	},
);

screenStory.it(
	"a closed request keeps its questionnaire readable in the document without an answer card",
	[routedScreen({ "proposal.md": questionnaireSource.replace("state: open", "state: closed") }, ITEM, writable)],
	function* ({ answerCardIds, readableOptions }) {
		yield* outcomes({
			"answer cards": [answerCardIds(), []],
			"readable options": [
				readableOptions(),
				[
					"Latest reply — compact, with older replies behind a link.",
					"Full history — keep earlier direction visible.",
					"Back/forward keeps the selected response.",
					"Reload restores the reading context.",
				],
			],
		});
	},
);

screenStory.it(
	"two open requests each get an answer card with only their own question and selection mode",
	[routedScreen({ "proposal.md": scopedQuestionnaire }, ITEM, writable)],
	function* ({ answerCardIds, duplicateCardIds, packetPrompts, selectionMode }) {
		yield* outcomes({
			"answer cards": [answerCardIds(), ["answer-card-direction", "answer-card-verification"]],
			"direction mode": [selectionMode("direction"), "one"],
			"direction questions": [packetPrompts("direction"), ["How should replies appear?"]],
			"IDs used twice": [duplicateCardIds(), []],
			"verification mode": [selectionMode("verification"), "many"],
			"verification questions": [packetPrompts("verification"), ["Which checks matter?"]],
		});
	},
);

screenStory.it(
	"a closed second request leaves its question readable in the document while the open request keeps its card",
	[routedScreen({ "proposal.md": secondRequestClosed }, ITEM, writable)],
	function* ({ answerCardIds, packetPrompts, readableQuestions }) {
		yield* outcomes({
			"answer cards": [answerCardIds(), ["answer-card-direction"]],
			"direction questions": [packetPrompts("direction"), ["How should replies appear?"]],
			"readable questions": [readableQuestions(), ["Which checks matter?"]],
		});
	},
);

screenStory.it(
	"sending a chosen option and typed text records one answer for every prompt",
	[routedScreen({ "proposal.md": questionnaireSource }, ITEM, writable)],
	function* ({ answerPrompt, check, previewPacket, recordedPacketAnswers, sendPacket }) {
		yield* check("history");
		yield* answerPrompt("checks", "None of these; test keyboard use instead.");
		yield* previewPacket();

		yield* sendPacket();

		expect(yield* recordedPacketAnswers("investigation.choices", "direction")).toEqual([
			[
				{ prompt: "display", selected: ["history"], text: "" },
				{ prompt: "checks", selected: [], text: "None of these; test keyboard use instead." },
			],
		]);
	},
);

screenStory.it(
	"a sent answer appears in the response history with its choice and text",
	[routedScreen({ "proposal.md": questionnaireSource }, ITEM, writable)],
	function* ({ answerPrompt, check, packetHistory, previewPacket, sendPacket }) {
		yield* check("history");
		yield* answerPrompt("checks", "None of these; test keyboard use instead.");
		yield* previewPacket();

		yield* sendPacket();

		expect(yield* packetHistory()).toEqual(expect.stringMatching(/Chose Full history.*None of these; test keyboard use instead\./su));
	},
);

screenStory.it(
	"a source change that rewords a chosen option clears that choice, keeps the typed text and says the source changed",
	[routedScreen({ "proposal.md": questionnaireSource }, ITEM, writable)],
	function* ({ answerPrompt, changeSource, check, packetChoice, packetStatus, previewPacket, promptText }) {
		yield* check("history");
		yield* answerPrompt("display", "Keep this rationale.");
		yield* previewPacket();
		expect(yield* packetChoice("history")).toBe("chosen");

		yield* changeSource("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));

		yield* outcomes({
			choice: [packetChoice("history"), "not chosen"],
			status: [packetStatus(), expect.stringContaining("Source changed")],
			"typed text": [promptText("display"), "Keep this rationale."],
		});
	},
);

screenStory.it(
	"a source change offers the choice made against the earlier packet for recovery",
	[routedScreen({ "proposal.md": questionnaireSource }, ITEM, writable)],
	function* ({ answerPrompt, changeSource, check, previewPacket, readDraftRecovery }) {
		yield* check("history");
		yield* answerPrompt("display", "Keep this rationale.");
		yield* previewPacket();

		yield* changeSource("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));

		expect(yield* readDraftRecovery()).toContain("history");
	},
);
