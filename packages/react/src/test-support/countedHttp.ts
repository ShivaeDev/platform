import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

export function countedHttp(base: Layer.Layer<HttpClient.HttpClient> = FetchHttpClient.layer) {
	const requests = { inFlight: 0 };
	const layer = Layer.effect(
		HttpClient.HttpClient,
		Effect.map(Effect.service(HttpClient.HttpClient), (client) =>
			HttpClient.transform(client, (response) =>
				Effect.acquireUseRelease(
					Effect.sync(() => {
						requests.inFlight += 1;
					}),
					() => response,
					() =>
						Effect.sync(() => {
							requests.inFlight -= 1;
						}),
				),
			),
		),
	).pipe(Layer.provide(base));
	return { inFlight: () => requests.inFlight, layer };
}
