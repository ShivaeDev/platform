import { expect } from "vitest";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

const FIRST = { id: "task.one.1", links: [], reason: "First choice", recommendation: "Retry" };
const SECOND = { id: "task.one.2", links: [], reason: "Second choice", recommendation: "Retry" };

boardFolderStory.it(
	"the daemon's Board answers include the open decision's answer and leave out a settled decision's answer",
	[folderContains("withDependency")],
	function* ({ acknowledge, answerDecision, boardAnswerSnapshot, publishDecision }) {
		const settled = yield* publishDecision(FIRST);
		yield* answerDecision(settled, "answer.first");
		yield* acknowledge(settled, "applied", "answer.first");
		yield* answerDecision(yield* publishDecision(SECOND), "answer.second");

		const answers = yield* boardAnswerSnapshot();

		expect(answers.map((entry) => entry.responseId)).toEqual(["answer.second"]);
	},
);

boardFolderStory.it(
	"a settled decision stays closed after the daemon reads its archived answer",
	[folderContains("withDependency")],
	function* ({ acknowledge, answerDecision, boardAnswerSnapshot, decisionState, publishDecision, reopenBoard }) {
		const settled = yield* publishDecision(FIRST);
		yield* answerDecision(settled, "answer.closed");
		yield* acknowledge(settled, "applied", "answer.closed");

		yield* boardAnswerSnapshot();

		yield* reopenBoard();
		expect(yield* decisionState(settled)).toBe("closed");
	},
);
