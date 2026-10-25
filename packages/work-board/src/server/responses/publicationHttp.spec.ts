import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [reviewer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";

boardStory.it(
	"preserves the winning response across concurrent HTTP servers and retries after restart",
	[projectFiles({ "task.md": SOURCE }, "the project has the stated publication files")],
	function* ({ notes, connectBoard, stopBoards }) {
		const first = yield* connectBoard();
		const second = yield* connectBoard();
		const preview = yield* Effect.promise(() => first.run(first.responses.question.run({ item: "task.choice", request: "direction" })));
		const question = yield* Effect.promise(() =>
			first.mutate(first.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
		);
		const input = { author: "reviewer", body: "First direction", id: "response.concurrent", question: question.id, type: "answer" as const };
		const attempts = yield* Effect.promise(() =>
			Promise.allSettled([
				first.mutate(first.responses.recordResponse.run(input)),
				second.mutate(second.responses.recordResponse.run({ ...input, body: "Other direction" })),
			]),
		);
		expect(attempts.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
		const winner = (yield* Effect.promise(() => first.run(first.responses.responses.run({ question: question.id })))).responses[0];
		expect(winner).toBeDefined();
		const bytes = yield* Effect.promise(() => readFile(join(notes.root, "responses/response.concurrent.md"), "utf8"));
		yield* stopBoards();
		const restarted = yield* connectBoard();
		expect(yield* Effect.promise(() => restarted.mutate(restarted.responses.recordResponse.run({ ...input, body: winner?.body ?? "" })))).toEqual(
			winner,
		);
		expect(yield* Effect.promise(() => readFile(join(notes.root, "responses/response.concurrent.md"), "utf8"))).toBe(bytes);
		expect(yield* Effect.promise(() => readFile(join(notes.root, "task.md"), "utf8"))).toBe(SOURCE);
		expect(
			yield* Effect.promise(() =>
				restarted.mutate(
					restarted.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
				),
			),
		).toEqual(question);
	},
);
