import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";
import { questionRegistered } from "#test/questionRecordTraits.ts";

const REQUIRED = questionnaireSource.replace('select="one"', 'select="one" required="selection"');
const WITHOUT_A_CHOICE = [{ ...questionnaireAnswers[0], selected: [] }, questionnaireAnswers[1]];

boardStory.it("a prompt marked required=selection is shown as needing a choice", [aQuestionnaire(REQUIRED)], function* ({ promptRequirements }) {
	expect(yield* promptRequirements("proposal.md")).toEqual(["display: choice required", "checks: choice optional"]);
});

boardStory.it(
	"an answer that leaves a required choice empty is refused",
	[aQuestionnaire(REQUIRED), questionRegistered()],
	function* ({ recordReply }) {
		expect(yield* recordReply({ answers: WITHOUT_A_CHOICE, body: "", id: "response.edge" })).toBe(
			"conflict: Choose an option before recording this answer. Keep your instructions in the note, or use Clarify / Not now.",
		);
	},
);

boardStory.it(
	"a clarification that leaves a required choice empty is recorded with its explanation",
	[aQuestionnaire(REQUIRED), questionRegistered()],
	function* ({ recordedReply, recordReply }) {
		yield* recordReply({ answers: WITHOUT_A_CHOICE, body: "", id: "response.edge", type: "clarify" });

		expect(yield* recordedReply("response.edge")).toEqual({
			body: expect.stringContaining(questionnaireAnswers[0].text),
			supersedes: undefined,
			type: "clarify",
		});
	},
);
