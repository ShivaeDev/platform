import { Clock, Effect } from "effect";
import { GitHub } from "@shivaedev/github/github/service.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { WatchError } from "#model.ts";
import { quotaMessage, quotaRetryAt } from "#quota.ts";

export const beforeRequest = Effect.fn("GitHubHttp.beforeRequest")(function* (state: HttpState) {
	const now = yield* Clock.currentTimeMillis;
	const github = yield* GitHub;
	const observations = yield* github.observations();
	const retryAt = quotaRetryAt(observations, state.retryAt);
	if (retryAt > now) {
		const budget = observations.find((entry) => entry.remaining === 0 && quotaRetryAt([entry]) === retryAt);
		return yield* new WatchError({
			message: budget === undefined ? "GitHub retry-after cooldown" : `GitHub quota cooldown (${quotaMessage(budget)})`,
			reason: "cooldown",
			retryAt,
		});
	}
});
