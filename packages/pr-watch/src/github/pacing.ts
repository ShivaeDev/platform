import { Effect } from "effect";
import { GitHubHttp } from "#github-http/service.ts";

export const pacing = Effect.fn("GitHub.pacing")(function* (interval: number) {
	const http = yield* GitHubHttp;
	return yield* http.pacing(interval);
});
