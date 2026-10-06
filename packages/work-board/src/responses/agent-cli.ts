import * as Effect from "effect/Effect";
import { agentRequest } from "./agent.ts";
import { flags } from "./flags.ts";

export async function runAgent(args: readonly string[]) {
	const [action, request, ...options] = args;
	if ((action !== "wait" && action !== "response" && action !== "question") || !request) {
		throw new Error(
			"Usage: work-board question <item>/<request> | wait <question-id> [--after <response-id>] | response <question-id> [--port 4747]",
		);
	}
	const parsed = flags(options);
	const controller = new AbortController();
	function cancel() {
		controller.abort();
	}
	process.once("SIGINT", cancel);
	process.once("SIGTERM", cancel);
	try {
		const result = await Effect.runPromise(
			agentRequest(action, { ...parsed, request }, (text) => process.stderr.write(`${text}\n`)).pipe(Effect.result),
			{ signal: controller.signal },
		);
		if (result._tag === "Failure") {
			if (result.failure instanceof Error && "code" in result.failure && result.failure.code === "Unanswered") {
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
