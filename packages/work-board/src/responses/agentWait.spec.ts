import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Clock, Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { agentRequest } from "./agent.ts";
import { questionMarkdown } from "./records.ts";

const execute = promisify(execFile);
const SOURCE =
	"---\nid: task.a\nattention:\n - id: question\n   kind: decision\n   state: open\n   reason: Which option?\n   response_from: [maintainer]\n   unblocks: [task.a]\n---\n# Options\n\nExplicit requests.\n";
let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "task.md": SOURCE });
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	client = browserClient(board.url);
	const preview = await client.run(client.responses.question.run({ item: "task.a", request: "question" }));
	return client.mutate(client.responses.registerQuestion.run({ item: "task.a", request: "question", revision: preview.reviewedRevision }));
}
it("uses the real bundled CLI, exits nonzero without stdout on an unanswered durable deadline, and delivers a late answer on retry", async () => {
	const original = await open();
	const question = {
		...original,
		question: {
			...original.question,
			deadline: Effect.runSync(Clock.currentTimeMillis) - 1000,
			registeredAt: Effect.runSync(Clock.currentTimeMillis) - 48 * 60 * 60 * 1000 - 1000,
		},
	};
	notes.write(`responses/${question.id}.md`, questionMarkdown(question));
	await board.stop();
	client.registry.dispose();
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	client = browserClient(board.url);
	const args = ["--conditions=source", "src/cli.ts", "wait", question.id, "--port", String(board.port)];
	await expect(execute(process.execPath, args, { cwd: new URL("../../", import.meta.url), timeout: 10_000 })).rejects.toMatchObject({
		code: 2,
		stderr: expect.stringContaining("unanswered for 48 hours"),
		stdout: "",
	});
	const response = await client.mutate(
		client.responses.recordResponse.run({
			author: "maintainer",
			body: "Not now; revisit next week.",
			id: "response.late",
			question: question.id,
			type: "not_now",
		}),
	);
	const returned = await execute(process.execPath, args, { cwd: new URL("../../", import.meta.url), timeout: 10_000 });
	expect(JSON.parse(returned.stdout)).toMatchObject({ kind: "response", response });
});
it("interrupts a waiting CLI request without cancelling or consuming the question", async () => {
	const question = await open();
	const controller = new AbortController();
	const waiting = Effect.runPromise(agentRequest("wait", { request: question.id, url: board.url }), { signal: controller.signal });
	controller.abort();
	await expect(waiting).rejects.toThrow();
	expect((await client.run(client.responses.responses.run({ question: question.id }))).question.id).toBe(question.id);
	expect((await client.run(client.responses.responses.run({ question: question.id }))).responses).toEqual([]);
});
