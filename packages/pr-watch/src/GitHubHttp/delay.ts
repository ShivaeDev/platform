import { Effect } from "effect";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { pacing } from "#GitHubHttp/pacing.ts";

export function delay(state: HttpState) {
	return Effect.fn("GitHubHttp.delay")((interval: number) => pacing(state)(interval).pipe(Effect.map((result) => result.delay)));
}
