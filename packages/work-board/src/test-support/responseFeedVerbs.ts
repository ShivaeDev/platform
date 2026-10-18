import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { createInterface } from "node:readline";
import { Effect } from "effect";
import type { ResponseKind } from "#browser/responses/schema.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

const openFeed = Effect.fn("Story.openFeed")(function* (root: string, since?: string) {
	const child = yield* Effect.acquireRelease(
		Effect.sync(() =>
			spawn(
				process.execPath,
				["--conditions=source", "src/server/cli.ts", "responses", "--follow", root, ...(since === undefined ? [] : ["--since", since])],
				{ cwd: new URL("../../", import.meta.url), stdio: "pipe" },
			),
		),
		(acquired) =>
			Effect.promise(async () => {
				if (acquired.exitCode === null && acquired.signalCode === null) {
					const closed = once(acquired, "close");
					acquired.kill();
					await closed;
				}
			}),
	);
	let stderr = "";
	child.stderr.on("data", (chunk: Buffer) => {
		stderr += chunk.toString();
	});
	const output = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
	let pending = output.next();
	const diagnostics = createInterface({ input: child.stderr })[Symbol.asyncIterator]();
	yield* Effect.promise(async () => {
		const ready = await diagnostics.next();
		if (ready.done || !ready.value.startsWith("Following responses in ")) {
			throw new Error(`Response feed did not start: ${stderr}`);
		}
	});
	return {
		nextLine: () =>
			Effect.promise(async () => {
				const line = await pending;
				pending = output.next();
				if (line.done) {
					throw new Error(`Response feed stopped: ${stderr}`);
				}
				return line.value;
			}).pipe(Effect.timeout("5 seconds")),
	};
});

export function responseFeedVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		followResponses: (since?: string) => {
			tell("the agent starts the bundled response feed for the project");
			return openFeed(engine.notes.root, since);
		},
		recordFeedResponse: (item: string, request: string, id: string, body: string, type: typeof ResponseKind.Type = "answer") =>
			Effect.promise(async () => {
				tell(`the maintainer records ${id} for ${item}/${request}`);
				const client = served(engine).client;
				const preview = await client.run(client.responses.question.run({ item, request }));
				const question = await client.mutate(client.responses.registerQuestion.run({ item, request, revision: preview.reviewedRevision }));
				return client.mutate(client.responses.recordResponse.run({ author: "maintainer", body, id, question: question.id, type }));
			}),
	};
}
