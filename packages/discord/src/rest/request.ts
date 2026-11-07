import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { HttpMethod } from "effect/http/HttpMethod";
import { readBoundedJson } from "@shivaedev/http/body.ts";
import { checkStatus } from "@shivaedev/http/checkStatus.ts";
import { isEmpty, isRateLimited } from "#adapters/restStatus.ts";
import { routeKey } from "#adapters/routeKey.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { DiscordRateLimited, DiscordTransportError } from "#errors.ts";
import type { initialize } from "#rest/initialize.ts";
import { DiscordRestLimits } from "#rest-limits/service.ts";

const Limited = Schema.Struct({ global: Schema.optional(Schema.Boolean), retryAfter: Schema.Number }).pipe(
	Schema.encodeKeys({ retryAfter: "retry_after" }),
);

export function request(lock: Effect.Success<typeof initialize>) {
	return Effect.fn("DiscordRest.request")(
		function* (method: HttpMethod, path: string, body?: unknown) {
			const client = HttpClient.withScope(yield* HttpClient.HttpClient);
			const token = yield* DiscordToken;
			const config = yield* DiscordConfig;
			const rates = yield* DiscordRestLimits;
			const { major, route } = routeKey(method, path);
			let input = HttpClientRequest.make(method)(`${config.apiUrl}${path}`).pipe(
				HttpClientRequest.setHeader("Authorization", `Bot ${Redacted.value(token)}`),
			);
			if (body !== undefined) {
				input = yield* HttpClientRequest.bodyJson(input, body);
			}
			for (let attempt = 0; ; attempt += 1) {
				yield* rates.wait(route, major);
				const answer = yield* Effect.gen(function* () {
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
				}).pipe(Effect.scoped);
				if (!answer.retry) {
					return answer.value;
				}
			}
		},
		lock.withPermit,
		Effect.catchTag("HttpClientError", () => Effect.fail(new DiscordTransportError({}))),
	);
}
