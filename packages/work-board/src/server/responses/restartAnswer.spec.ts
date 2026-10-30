import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { heldRegisteredRead } from "#test/heldRegisteredRead.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";
const held = heldRegisteredRead("task.md");

boardStory.it(
	"Board restart finishes an in-flight answer and retry returns the same response exactly once",
	[projectFiles({ "task.md": SOURCE }), responsesEnabled(), boardFilesystem(held.wrap)],
	function* (board) {
		const preview = yield* Effect.promise(() => board.client.run(board.client.responses.question.run({ item: "task.choice", request: "direction" })));
		const input = {
			author: "maintainer",
			body: "Take the first direction.",
			id: "response.restart",
			item: "task.choice",
			request: "direction",
			revision: preview.reviewedRevision,
			type: "answer" as const,
		};
		const saving = yield* board.beginAnswer(input);
		yield* Effect.promise(() => held.started);

		const stopped = yield* board.beginShutdown();
		yield* saving.finished;
		held.release();
		yield* stopped;
		yield* board.start();

		function read() {
			return board.client.run(board.client.responses.responses.run({ question: preview.id }));
		}
		const before = yield* Effect.promise(read);
		expect(before.responses).toMatchObject([{ body: input.body, id: input.id }]);
		const retried = yield* Effect.promise(() => board.client.mutate(board.client.responses.answerQuestion.run(input)));
		expect(retried).toEqual(before.responses[0]);
		expect((yield* Effect.promise(read)).responses).toEqual(before.responses);
	},
);
