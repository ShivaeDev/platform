import { Effect, Schema } from "effect";
import { CheckRun, UpdateCheckRun } from "#checkRunSchemas.ts";
import { write } from "#github/write.ts";
import type { GitHubState } from "#initializeGitHub.ts";

export function updateCheckRun(state: GitHubState) {
	return Effect.fn("GitHub.updateCheckRun")(function* (owner: string, repo: string, id: number, input: typeof UpdateCheckRun.Type) {
		const body = yield* Schema.encodeEffect(UpdateCheckRun)(input);
		const response = yield* write(state)("PATCH", `/repos/${owner}/${repo}/check-runs/${id}`, body);
		return yield* response.decode(CheckRun);
	});
}
