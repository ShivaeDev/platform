import { Effect, Schema } from "effect";
import { CheckRun, CreateCheckRun } from "#checkRunSchemas.ts";
import type { Representations } from "#representations.ts";

export function createCheckRun(client: Representations) {
	return Effect.fn("GitHub.createCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(CreateCheckRun)(input);
		const response = yield* client.write("POST", `/repos/${owner}/${repo}/check-runs`, body);
		return yield* response.decode(CheckRun);
	});
}
