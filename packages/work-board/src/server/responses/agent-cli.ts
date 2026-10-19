import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Stream } from "effect";
import * as Effect from "effect/Effect";
import { Unanswered } from "#rpc/rejections.ts";
import { agentRequest } from "./agent.ts";
import { agentArguments } from "./agentArguments.ts";
import { responseFeed } from "./feed.ts";

const followResponses = Effect.fn("WorkBoard.followResponses")(function* (
	root: string,
	since: number,
	write: (line: string) => void,
	diagnostic: (line: string) => void,
) {
	diagnostic(`Following responses in ${root} since ${new Date(since).toISOString()}.`);
	return yield* responseFeed(root, since).pipe(
		Stream.runForEach((line) => Effect.sync(() => write(line))),
		Effect.provide(NodeServices.layer),
	);
});

export async function runAgent(args: readonly string[]) {
	const controller = new AbortController();
	function cancel() {
		controller.abort();
	}
	process.once("SIGINT", cancel);
	process.once("SIGTERM", cancel);
	try {
		const command = Effect.gen(function* () {
			const parsed = yield* agentArguments(args);
			if (parsed.action === "follow") {
				yield* followResponses(
					parsed.root,
					parsed.since,
					(line) => process.stdout.write(`${line}\n`),
					(line) => process.stderr.write(`${line}\n`),
				);
			} else {
				const response = yield* agentRequest(parsed.action, parsed.options, (text) => process.stderr.write(`${text}\n`));
				process.stdout.write(`${JSON.stringify(response)}\n`);
			}
		});
		const result = await Effect.runPromise(command.pipe(Effect.result), {
			signal: controller.signal,
		});
		if (result._tag === "Failure") {
			if (result.failure instanceof Unanswered) {
				process.exitCode = 2;
			}
			throw result.failure;
		}
	} finally {
		process.removeListener("SIGINT", cancel);
		process.removeListener("SIGTERM", cancel);
	}
}
