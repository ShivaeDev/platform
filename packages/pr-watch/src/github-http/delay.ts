import { Effect } from "effect";
import type { HttpState } from "#github-http/initialize.ts";
import { pacing } from "#github-http/pacing.ts";

export function delay(state: HttpState) {
	return Effect.fn("GitHubHttp.delay")((interval: number) => pacing(state)(interval).pipe(Effect.map((result) => result.delay)));
}
