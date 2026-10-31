import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";
import { questionRegistered, replyRecorded } from "#test/questionRecordTraits.ts";

const ANSWERED = [
	aQuestionnaire(),
	questionRegistered(),
	replyRecorded({ answers: questionnaireAnswers, body: "Keep the rationale.", id: "response.edge" }),
];

for (const { action, refusal, request } of [
	{ action: "question", refusal: "bad request: Use question <item>/<request>.", request: "investigation.choices" },
	{
		action: "wait",
		refusal: "bad request: Use wait <item>/<request> --revision <reviewed SHA-256>, or wait <registered-question-id>.",
		request: "investigation.choices/direction",
	},
] as const) {
	boardStory.it(`an agent ${action} that misses part of its reference is told the command's form`, [aQuestionnaire()], function* ({ agentAsks }) {
		expect(yield* agentAsks(action, request)).toBe(refusal);
	});
}

boardStory.it(
	"an agent waiting by item, request and reviewed revision receives the reply already recorded",
	ANSWERED,
	function* ({ agentWaitsByShorthand }) {
		expect(yield* agentWaitsByShorthand()).toBe("response.edge");
	},
);

boardStory.it(
	"an agent waiting by item and request is told the question identity to reattach with",
	ANSWERED,
	function* ({ agentMessages, agentWaitsByShorthand }) {
		yield* agentWaitsByShorthand();

		expect(yield* agentMessages()).toEqual([
			expect.stringMatching(/^Registered (?<id>question\.[0-9a-f]{64}); reattach with work-board wait \k<id>\. Deadline: \d{4}-\d\d-\d\dT[\d:.]+Z$/u),
		]);
	},
);

boardStory.it("an agent reads the replies to a registered question by its identity", ANSWERED, function* ({ agentReadsReplies }) {
	expect(yield* agentReadsReplies()).toEqual(["response.edge"]);
});
