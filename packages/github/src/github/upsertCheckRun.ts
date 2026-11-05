import { Effect, Option, Schema } from "effect";
import { CreateCheckRun } from "#checkRunSchemas.ts";
import { createCheckRun } from "#github/createCheckRun.ts";
import { findLatestCheckRun } from "#github/findLatestCheckRun.ts";
import { updateCheckRun } from "#github/updateCheckRun.ts";
import type { GitHubState } from "#initializeGitHub.ts";

export function upsertCheckRun(state: GitHubState) {
	return Effect.fn("GitHub.upsertCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type, appId?: number) {
		yield* Schema.encodeEffect(CreateCheckRun)(input);
		const existing = yield* findLatestCheckRun(state)(owner, repo, { appId, headSha: input.headSha, name: input.name });
		return yield* Option.isSome(existing) ? updateCheckRun(state)(owner, repo, existing.value.id, input) : createCheckRun(state)(owner, repo, input);
	});
}
