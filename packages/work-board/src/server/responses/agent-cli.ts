import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Clock, Schema, Stream } from "effect";
import * as Effect from "effect/Effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { Unanswered } from "#rpc/rejections.ts";
import { agentRequest } from "./agent.ts";
import { responseFeed } from "./feed.ts";
import { flags } from "./flags.ts";

const followResponses = Effect.fn("WorkBoard.followResponses")(function* (
	args: readonly string[],
	write: (line: string) => void,
	diagnostic: (line: string) => void,
) {
	const [follow, root, option, timestamp, ...extra] = args;
	if (follow !== "--follow" || !root || root.startsWith("--") || extra.length > 0 || (option !== undefined && (option !== "--since" || !timestamp))) {
		return yield* Effect.fail(new BadRequest({ message: "Usage: work-board responses --follow <dir> [--since <ISO timestamp>]" }));
	}
	const since = timestamp === undefined ? yield* Clock.currentTimeMillis : Date.parse(timestamp);
	if (!Number.isFinite(since)) {
		return yield* Effect.fail(new BadRequest({ message: "Use --since with an ISO timestamp, such as 2026-01-01T00:00:00Z." }));
	}
	diagnostic(`Following responses in ${root} since ${new Date(since).toISOString()}.`);
	return yield* responseFeed(root, since).pipe(
		Stream.runForEach((line) => Effect.sync(() => write(line))),
		Effect.provide(NodeServices.layer),
	);
});

const agentCommand = Effect.fn("WorkBoard.agentCommand")(function* (args: readonly string[], diagnostic: (text: string) => void = () => undefined) {
	const [action, request, ...options] = args;
	if ((action !== "wait" && action !== "response" && action !== "question") || !request) {
		return yield* Effect.fail(
			new BadRequest({
				message: "Usage: work-board question <item>/<request> | wait <question-id> [--after <response-id>] | response <question-id> [--port 4747]",
			}),
		);
	}
	const parsed = yield* Effect.try({
		catch: (cause) =>
			Schema.is(BadRequest)(cause) ? cause : new BadRequest({ message: "Use --port, --url, --revision or --after, each with a value." }),
		try: () => flags(options),
	});
	return yield* agentRequest(action, { ...parsed, request }, diagnostic);
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
			if (args[0] === "responses") {
				yield* followResponses(
					args.slice(1),
					(line) => process.stdout.write(`${line}\n`),
					(line) => process.stderr.write(`${line}\n`),
				);
			} else {
				const response = yield* agentCommand(args, (text) => process.stderr.write(`${text}\n`));
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
