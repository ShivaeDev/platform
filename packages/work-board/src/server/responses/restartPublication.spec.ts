import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles, responsesEnabled } from "#test/boardStory.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";

for (const phase of ["temporary", "published"] as const) {
	boardStory.it(
		`SIGKILL during Board answer publication at ${phase} resumes one answer and the response follower sees no gap or duplicate`,
		[deferredServing, projectFiles({ "task.md": SOURCE }), responsesEnabled()],
		function* (board) {
			const writer = yield* board.startPublicationWriter(phase);
			const preview = yield* writer.preview();
			const feed = yield* board.followResponses("1970-01-01T00:00:00.000Z");
			const input = {
				author: "maintainer",
				body: "Use PostgreSQL.",
				id: "response.restart",
				item: "task.choice",
				request: "direction",
				revision: preview.reviewedRevision,
				type: "answer" as const,
			};
			const saving = yield* writer.answer(input);
			expect((yield* writer.next()).phase).toBe(phase);

			yield* writer.kill;
			yield* saving.finished;
			yield* board.start();
			const saved = yield* Effect.promise(() => board.client.mutate(board.client.responses.answerQuestion.run(input)));
			const retried = yield* Effect.promise(() => board.client.mutate(board.client.responses.answerQuestion.run(input)));

			expect(retried).toEqual(saved);
			expect(saved).toMatchObject({ body: input.body, id: input.id });
			expect(yield* feed.nextLine()).toBe("task.choice\tdirection\tresponse.restart\tUse PostgreSQL.");
			yield* board.recordFeedResponse("task.choice", "direction", "response.next", "Keep the migration.");
			expect(yield* feed.nextLine()).toBe("task.choice\tdirection\tresponse.next\tKeep the migration.");
			const read = yield* Effect.promise(() => board.client.run(board.client.responses.responses.run({ question: preview.id })));
			expect(read.responses.map(({ id, body }) => ({ body, id }))).toEqual([
				{ body: "Use PostgreSQL.", id: "response.restart" },
				{ body: "Keep the migration.", id: "response.next" },
			]);
		},
	);
}
