import { Effect, Option, Schema } from "effect";
import { CreateCheckRun } from "#checkRunSchemas.ts";
import { createCheckRun } from "#operations/createCheckRun.ts";
import { findLatestCheckRun } from "#operations/findLatestCheckRun.ts";
import { updateCheckRun } from "#operations/updateCheckRun.ts";
import type { Representations } from "#representations.ts";

export function upsertCheckRun(client: Representations) {
	return Effect.fn("GitHub.upsertCheckRun")(function* (owner: string, repo: string, input: typeof CreateCheckRun.Type, appId?: number) {
		yield* Schema.encodeEffect(CreateCheckRun)(input);
		const existing = yield* findLatestCheckRun(client)(owner, repo, { appId, headSha: input.headSha, name: input.name });
		return yield* Option.isSome(existing)
			? updateCheckRun(client)(owner, repo, existing.value.id, input)
			: createCheckRun(client)(owner, repo, input);
	});
}
