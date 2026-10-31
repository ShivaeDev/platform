import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";
import { questionRegistered, replyRecorded } from "#test/questionRecordTraits.ts";

const SOURCE_CHANGED = "precondition failed: Source changed or moved. Keep the draft and review the new revision before responding.";
const RECORDED_BODY = [
	"# Recorded response",
	"## Question: display",
	"### How should replies appear?",
	"Selected: history",
	"**Full history** — keep earlier direction visible.",
	"Additional text:",
	"Preserve why the direction changed.",
	"## Question: checks",
	"### Which checks matter?",
	"Selected: back, reload",
	"Back/forward keeps the selected response.",
	"Reload restores the reading context.",
	"Additional text:",
	"Check a narrow screen too.",
	"## Overall response",
	"Build the grouped history next.",
].join("\n\n");
const ANSWER = { answers: questionnaireAnswers, body: "Build the grouped history next.", id: "response.choice" };
const REJECTING_EVERY_OPTION = questionnaireAnswers.map((answer) => ({ ...answer, selected: [], text: "None of these; revise the premise." }));

boardStory.it(
	"a questionnaire answer stores each prompt's choices and writes them into the reply ahead of the maintainer's note",
	[aQuestionnaire(), questionRegistered()],
	function* ({ recordedReply, recordReply, savedAnswers }) {
		yield* recordReply(ANSWER);

		yield* outcomes({
			reply: [recordedReply("response.choice"), { body: RECORDED_BODY, supersedes: undefined, type: "answer" }],
			"stored answers": [savedAnswers("response.choice"), questionnaireAnswers],
		});
	},
);

boardStory.it(
	"recording the same questionnaire answer again returns the first record",
	[aQuestionnaire(), questionRegistered()],
	function* ({ recordReply }) {
		const first = yield* recordReply(ANSWER);

		expect(yield* recordReply(ANSWER)).toEqual(first);
	},
);

boardStory.it(
	"an agent waiting on the questionnaire receives the recorded answer",
	[aQuestionnaire(), questionRegistered(), replyRecorded(ANSWER)],
	function* ({ agentWaits }) {
		expect(yield* agentWaits()).toBe("response.choice");
	},
);

boardStory.it(
	"an answer that turns down every option in the maintainer's own words is recorded",
	[aQuestionnaire(), questionRegistered()],
	function* ({ recordReply, savedAnswers }) {
		yield* recordReply({ answers: REJECTING_EVERY_OPTION, body: "", id: "response.choice" });

		expect(yield* savedAnswers("response.choice")).toEqual(REJECTING_EVERY_OPTION);
	},
);

boardStory.it(
	"after proposal.md moves, an answer to the question registered before is refused",
	[aQuestionnaire(), questionRegistered()],
	function* ({ outsideEditorMoves, recordReply }) {
		yield* outsideEditorMoves("proposal.md", "moved.md");

		expect(yield* recordReply({ answers: questionnaireAnswers, body: "", id: "response.stale" })).toBe(SOURCE_CHANGED);
	},
);

boardStory.it(
	"after proposal.md moves, an answer to the re-registered question can supersede the earlier answer, which stays the old question's only reply",
	[aQuestionnaire(), questionRegistered(), replyRecorded({ answers: questionnaireAnswers, body: "", id: "response.old" })],
	function* ({ outsideEditorMoves, recordedReply, recordReply, registerQuestion, replyHistory }) {
		yield* outsideEditorMoves("proposal.md", "moved.md");
		yield* registerQuestion();

		yield* recordReply({ answers: questionnaireAnswers, body: "Replaces earlier direction.", id: "response.new", supersedes: "response.old" });

		yield* outcomes({
			"earlier question's replies": [replyHistory("earlier"), ["response.old"]],
			"new answer": [
				recordedReply("response.new"),
				{ body: expect.stringContaining("Replaces earlier direction."), supersedes: "response.old", type: "answer" },
			],
		});
	},
);
