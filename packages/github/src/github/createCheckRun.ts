import { Effect, Schema } from "effect";
import { CheckRun, CreateCheckRun } from "#checkRunSchemas.ts";
import { write } from "#github/write.ts";
import type { GitHubState } from "#initializeGitHub.ts";

export function createCheckRun(state: GitHubState) {
	return Effect.fn("GitHub.createCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(CreateCheckRun)(input);
		const response = yield* write(state)("POST", `/repos/${owner}/${repo}/check-runs`, body);
		return yield* response.decode(CheckRun);
	});
}
