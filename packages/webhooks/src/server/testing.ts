import { Effect, type Redacted } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { githubHeaders } from "#server/adapters/githubHeaders.ts";
import type { WebhookSource } from "#server/registration.ts";

export type WebhookSigner<E = never, R = never> = (
	body: string,
	key: Redacted.Redacted<string>,
) => Effect.Effect<Readonly<Record<string, string>>, E, R>;

export interface WebhookDeliveryOptions<E = never, R = never> {
	readonly body: string;
	readonly headers?: Readonly<Record<string, string | null>>;
	readonly sign?: WebhookSigner<E, R>;
	readonly source: Pick<WebhookSource, "key">;
	readonly url: string;
}

export const deliverWebhook = Effect.fnUntraced(function* <E = never, R = never>(options: WebhookDeliveryOptions<E, R>) {
	const key = yield* options.source.key;
	const signed = yield* (options.sign ?? githubHeaders)(options.body, key);
	const headers: Record<string, string> = {};
	for (const [name, value] of [...Object.entries(signed), ...Object.entries(options.headers ?? {})]) {
		const lower = name.toLowerCase();
		if (value === null) {
			delete headers[lower];
		} else {
			headers[lower] = value;
		}
	}
	const client = yield* HttpClient.HttpClient;
	return yield* client.post(options.url, { body: HttpBody.text(options.body, "application/json"), headers });
});
