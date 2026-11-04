import { Effect, Redacted, Schema, Semaphore } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { HttpMethod } from "effect/http/HttpMethod";
import { readBoundedJson } from "@shivaedev/http/body.ts";
import { checkStatus } from "@shivaedev/http/checkStatus.ts";
import { isEmpty, isRateLimited } from "#adapters/restStatus.ts";
import { routeKey } from "#adapters/routeKey.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { DiscordRateLimited, DiscordTransportError } from "#errors.ts";
import { rateLimits } from "#rateLimits.ts";

const Limited = Schema.Struct({ global: Schema.optional(Schema.Boolean), retryAfter: Schema.Number }).pipe(
	Schema.encodeKeys({ retryAfter: "retry_after" }),
);

export const initializeRest = Effect.gen(function* () {
	const client = HttpClient.withScope(yield* HttpClient.HttpClient);
	const token = yield* DiscordToken;
	const config = yield* DiscordConfig;
	const rates = rateLimits();
	const lock = yield* Semaphore.make(1);
	const request = Effect.fnUntraced(function* (method: HttpMethod, path: string, body?: unknown) {
		const { major, route } = routeKey(method, path);
		let input = HttpClientRequest.make(method)(`${config.apiUrl}${path}`).pipe(
			HttpClientRequest.setHeader("Authorization", `Bot ${Redacted.value(token)}`),
		);
		if (body !== undefined) {
			input = yield* HttpClientRequest.bodyJson(input, body);
		}
		for (let attempt = 0; ; attempt += 1) {
			yield* rates.wait(route, major);
			const answer = yield* Effect.scoped(
				Effect.gen(function* () {
					const response = yield* client.execute(input);
					yield* rates.observe(route, major, response.headers);
					if (isRateLimited(response.status)) {
						const limit = yield* readBoundedJson(response, 64 * 1024, Limited);
						yield* rates.refuse(route, major, limit.retryAfter, limit.global === true);
						if (attempt === 3) {
							return yield* new DiscordRateLimited({ retryAfter: limit.retryAfter });
						}
						return { retry: true, value: undefined };
					}
					yield* checkStatus(response);
					const value = isEmpty(response.status) ? undefined : yield* readBoundedJson(response, 1024 * 1024, Schema.Unknown);
					return { retry: false, value };
				}),
			);
			if (!answer.retry) {
				return answer.value;
			}
		}
	});
	return { lock, request };
});

export function restRequest(state: Effect.Success<typeof initializeRest>) {
	return (method: HttpMethod, path: string, body?: unknown) =>
		state.request(method, path, body).pipe(
			state.lock.withPermit,
			Effect.catchTag("HttpClientError", () => Effect.fail(new DiscordTransportError({}))),
		);
}
