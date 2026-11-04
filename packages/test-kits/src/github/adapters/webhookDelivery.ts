import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

export function webhookDelivery(sign: (body: Uint8Array) => string) {
	return Effect.fnUntraced(function* (url: string, delivery: { readonly body: Uint8Array; readonly event: string; readonly deliveryId: string }) {
		const client = yield* HttpClient.HttpClient;
		const response = yield* client.execute(
			HttpClientRequest.post(url).pipe(
				HttpClientRequest.setHeaders({
					"content-type": "application/json",
					"x-github-delivery": delivery.deliveryId,
					"x-github-event": delivery.event,
					"x-hub-signature-256": sign(delivery.body),
				}),
				HttpClientRequest.bodyUint8Array(delivery.body),
			),
		);
		yield* response.text;
		return response.status;
	}, Effect.provide(FetchHttpClient.layer));
}
