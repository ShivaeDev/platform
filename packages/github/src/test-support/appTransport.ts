import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

export function appTransport() {
	const failures: unknown[] = [];
	const layer = Layer.effect(HttpClient.HttpClient)(
		Effect.map(HttpClient.HttpClient, (client) =>
			HttpClient.transformResponse(
				client,
				Effect.mapError((cause) => {
					failures.push(cause);
					return cause;
				}),
			),
		),
	).pipe(Layer.provide(FetchHttpClient.layer));
	return { failures, layer };
}
