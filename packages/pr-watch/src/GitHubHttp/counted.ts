import { Effect } from "effect";
import type { HttpState } from "#GitHubHttp/initialize.ts";

export function counted<T, E, R>(state: HttpState, operation: Effect.Effect<T, E, R>) {
	return Effect.suspend(() => {
		state.requests += 1;
		return operation;
	});
}
