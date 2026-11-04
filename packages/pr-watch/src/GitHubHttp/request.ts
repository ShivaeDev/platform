import { Effect } from "effect";
import { beforeRequest } from "#GitHubHttp/beforeRequest.ts";
import type { HttpState } from "#GitHubHttp/initialize.ts";
import { requestFailure } from "#requestFailure.ts";

export function request<T, E, R>(state: HttpState, operation: Effect.Effect<T, E, R>) {
	return beforeRequest(state).pipe(
		Effect.andThen(operation),
		Effect.scoped,
		Effect.timeout("30 seconds"),
		Effect.tapError((error) =>
			Effect.sync(() => {
				const { retryAt } = requestFailure(error);
				if (retryAt !== undefined) {
					state.retryAt = retryAt;
				}
			}),
		),
	);
}
