import { Effect, Schema } from "effect";
import { CheckRun, UpdateCheckRun } from "#checkRunSchemas.ts";
import type { Representations } from "#representations.ts";

export function updateCheckRun(client: Representations) {
	return Effect.fn("GitHub.updateCheckRun")(function* (owner: string, repo: string, id: number, input: typeof UpdateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(UpdateCheckRun)(input);
		const response = yield* client.write("PATCH", `/repos/${owner}/${repo}/check-runs/${id}`, body);
		return yield* response.decode(CheckRun);
	});
}
