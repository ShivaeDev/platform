import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionRegistered, replyRecorded } from "#test/questionRecordTraits.ts";

const CLARIFY = { body: "Please clarify the intended outcome.", id: "response.edge", type: "clarify" } as const;

boardStory.it(
	"registering the question again after an outside editor moved its record is refused",
	[aQuestionnaire(), questionRegistered()],
	function* ({ outsideEditorMovesQuestionRecord, registerQuestion }) {
		yield* outsideEditorMovesQuestionRecord("moved.md");

		expect(yield* registerQuestion()).toBe(
			"conflict: The registered identity moved or is duplicated. Read the existing record instead of retrying a write.",
		);
	},
);

boardStory.it("a reply cannot take the identity of a project item", [aQuestionnaire(), questionRegistered()], function* ({ recordReply }) {
	expect(yield* recordReply({ ...CLARIFY, id: "investigation.choices" })).toBe("conflict: This response identity is already used.");
});

boardStory.it(
	"recording a reply again after an outside editor moved its saved file is refused",
	[aQuestionnaire(), questionRegistered(), replyRecorded(CLARIFY)],
	function* ({ outsideEditorMoves, recordReply }) {
		yield* outsideEditorMoves("responses/response.edge.md", "moved.md");

		expect(yield* recordReply(CLARIFY)).toBe("conflict: The saved response moved. Read its existing record instead of retrying a write.");
	},
);
