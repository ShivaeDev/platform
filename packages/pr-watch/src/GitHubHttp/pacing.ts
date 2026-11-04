import { Clock, Effect } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { pollPacing } from "#quota.ts";

export function pacing(state: HttpState) {
	return Effect.fn("GitHubHttp.pacing")(function* (interval: number) {
		const now = yield* Clock.currentTimeMillis;
		const github = yield* GitHub;
		const observations = yield* github.observations();
		const result = pollPacing(observations, interval, Math.max(1, state.requests), now, state.retryAt);
		state.requests = 0;
		return result;
	});
}
