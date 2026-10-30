import { expect } from "vitest";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

boardFolderStory.it(
	"the daemon emits the open decision's answer and omits a settled decision's answer",
	[folderContains("withDependency")],
	function* (folder) {
		const first = yield* folder.board.decision("task.one", { id: "task.one.1", links: [], reason: "First choice", recommendation: "Retry" });
		const answer = yield* folder.answerDecision(first, "answer.first");
		yield* folder.board.acknowledgeDecision({ decision: first, disposition: "applied", recordedAt: 10, responseId: answer.id });
		const second = yield* folder.board.decision("task.one", { id: "task.one.2", links: [], reason: "Second choice", recommendation: "Retry" });
		yield* folder.answerDecision(second, "answer.second");

		const answers = yield* folder.boardAnswerSnapshot();

		expect(answers.map((entry) => entry.responseId)).toEqual(["answer.second"]);
	},
);

boardFolderStory.it(
	"a settled decision stays closed when Fleet opens its archived answer on demand",
	[folderContains("withDependency")],
	function* (folder) {
		const decision = yield* folder.board.decision("task.one", { id: "task.one.1", links: [], reason: "Choose", recommendation: "Retry" });
		const answer = yield* folder.answerDecision(decision, "answer.closed");
		yield* folder.board.acknowledgeDecision({ decision, disposition: "applied", recordedAt: 10, responseId: answer.id });
		yield* folder.boardAnswerSnapshot();
		const reopened = yield* folder.reopenBoard();

		expect(yield* reopened.readDecision(decision)).toEqual({ _tag: "Closed" });
	},
);
