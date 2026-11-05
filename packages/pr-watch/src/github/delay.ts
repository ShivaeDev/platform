import { Effect } from "effect";
import { GitHubHttp } from "#github-http/service.ts";

export const delay = Effect.fn("GitHub.delay")(function* (interval: number) {
	const http = yield* GitHubHttp;
	return yield* http.delay(interval);
});
