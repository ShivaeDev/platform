import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard } from "#test/board.ts";
import { embeddedBoard } from "#test/embeddedBoard.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [reviewer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";

let notes: Folder;

const boards: RunningBoard[] = [];

const clients: ReturnType<typeof browserClient>[] = [];

afterEach(async () => {
	for (const client of clients.splice(0)) {
		client.registry.dispose();
	}
	await Promise.all(boards.splice(0).map((board) => board.stop()));
	notes?.remove();
});

const connectBoard = Effect.fn("Test.connectBoard")(function* () {
	const board = yield* embeddedBoard(notes.root, true);
	boards.push(board);
	const result = browserClient(board.url);
	clients.push(result);
	return result;
});

it.live("preserves the winning response across concurrent HTTP servers and retries after restart", function* () {
	notes = folder({ "task.md": SOURCE });
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
	expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
	expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
	const winner = (yield* Effect.promise(() => first.run(first.responses.responses.run({ question: question.id })))).responses[0];
	expect(winner).toBeDefined();
	const bytes = yield* Effect.promise(() => readFile(join(notes.root, "responses/response.concurrent.md"), "utf8"));
	for (const running of boards.splice(0)) {
		yield* running.stop();
	}
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
});
