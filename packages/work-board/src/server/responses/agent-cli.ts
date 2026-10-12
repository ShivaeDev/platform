import process from "node:process";
import { Schema } from "effect";
import * as Effect from "effect/Effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { Unanswered } from "#rpc/rejections.ts";
import { agentRequest } from "./agent.ts";
import { flags } from "./flags.ts";

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
		const result = await Effect.runPromise(agentCommand(args, (text) => process.stderr.write(`${text}\n`)).pipe(Effect.result), {
			signal: controller.signal,
		});
		if (result._tag === "Failure") {
			if (result.failure instanceof Unanswered) {
				process.exitCode = 2;
			}
			throw result.failure;
		}
		process.stdout.write(`${JSON.stringify(result.success)}\n`);
	} finally {
		process.removeListener("SIGINT", cancel);
		process.removeListener("SIGTERM", cancel);
	}
}
