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

type Feed = Effect.Success<ReturnType<typeof openFeed>>;

interface FeedState {
	feed?: Feed;
	readonly recordedAt: Map<string, number>;
}

const states = new WeakMap<BoardEngine, FeedState>();

function feedState(engine: BoardEngine) {
	const known = states.get(engine);
	if (known) {
		return known;
	}
	const created: FeedState = { recordedAt: new Map() };
	states.set(engine, created);
	return created;
}

export function responseFeedVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const state = feedState(engine);
	function follow(since?: string) {
		return Effect.map(openFeed(engine.notes.root, since), (feed) => {
			state.feed = feed;
		});
	}
	return {
		feedPrints: () => {
			tell("the reader reads the next line the response feed prints");
			if (!state.feed) {
				throw new Error("No response feed is running; call followResponses() first");
			}
			return state.feed.nextLine();
		},
		followAllResponses: () => {
			tell("the agent starts the bundled response feed for the project from the beginning");
			return follow("1970-01-01T00:00:00.000Z");
		},
		followResponses: () => {
			tell("the agent starts the bundled response feed for the project");
			return follow();
		},
		followResponsesSince: (id: string) => {
			tell(`the agent starts the bundled response feed from the moment ${id} was recorded`);
			const recordedAt = state.recordedAt.get(id);
			if (recordedAt === undefined) {
				throw new Error(`${id} was not recorded through maintainerReplies()`);
			}
			return follow(new Date(recordedAt).toISOString());
		},
		maintainerReplies: (item: string, request: string, id: string, body: string, type: typeof ResponseKind.Type = "answer") =>
			Effect.promise(async () => {
				tell(`the maintainer records ${id}${type === "answer" ? "" : ` as ${type}`} for ${item}/${request}: ${body}`);
				const client = served(engine).client;
				const preview = await client.run(client.responses.question.run({ item, request }));
				const saved = await client.mutate(
					client.responses.answerQuestion.run({ author: "maintainer", body, id, item, request, revision: preview.reviewedRevision, type }),
				);
				state.recordedAt.set(id, saved.response.recordedAt);
			}),
	};
}
