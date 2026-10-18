import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import { Cause, Clock, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { agentRequest } from "./agent.ts";
import { questionMarkdown } from "./records.ts";

const execute = promisify(execFile);

const SOURCE =
	"---\nid: task.a\nattention:\n - id: question\n   kind: decision\n   state: open\n   reason: Which option?\n   response_from: [maintainer]\n   unblocks: [task.a]\n---\n# Options\n\nExplicit requests.\n";

boardStory.it(
	"uses the real bundled CLI, exits nonzero without stdout on an unanswered durable deadline, and delivers a late answer on retry",
	[projectFiles({ "task.md": SOURCE }, "a project source awaits direction"), responsesEnabled()],
	function* ({ board, client, register, restart, editFile }) {
		const original = yield* register("task.a", "question");
		const question = {
			...original,
			question: {
				...original.question,
				deadline: (yield* Clock.currentTimeMillis) - 1000,
				registeredAt: (yield* Clock.currentTimeMillis) - 48 * 60 * 60 * 1000 - 1000,
			},
		};
		editFile(`responses/${question.id}.md`, questionMarkdown(question));
		({ board, client } = yield* restart(true));
		const args = ["--conditions=source", "src/server/cli.ts", "wait", question.id, "--port", String(board.port)];
		yield* Effect.promise(() =>
			expect(execute(process.execPath, args, { cwd: new URL("../../../", import.meta.url), timeout: 10_000 })).rejects.toMatchObject({
				code: 2,
				stderr: expect.stringContaining("unanswered for 48 hours"),
				stdout: "",
			}),
		);
		const response = yield* Effect.promise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					author: "maintainer",
					body: "Not now; revisit next week.",
					id: "response.late",
					question: question.id,
					type: "not_now",
				}),
			),
		);
		const returned = yield* Effect.promise(() => execute(process.execPath, args, { cwd: new URL("../../../", import.meta.url), timeout: 10_000 }));
		expect(JSON.parse(returned.stdout)).toMatchObject({ kind: "response", response });
	},
);

boardStory.it(
	"interrupts a waiting CLI request without cancelling or consuming the question",
	[projectFiles({ "task.md": SOURCE }, "a project source awaits direction"), responsesEnabled()],
	function* ({ board, client, register }) {
		const question = yield* register("task.a", "question");
		const waiting = yield* agentRequest("wait", { request: question.id, url: board.url }).pipe(Effect.forkChild);
		yield* Fiber.interrupt(waiting);
		const interrupted = yield* Fiber.await(waiting);
		expect(Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)).toBe(true);
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).question.id).toBe(question.id);
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([]);
	},
);
