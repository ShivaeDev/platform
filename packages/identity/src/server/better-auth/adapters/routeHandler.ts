import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { clientIpHeaders } from "#server/better-auth/adapters/clientIp.ts";
import { type MountedAuth, type MountRouteOptions, response } from "#server/better-auth/adapters/response.ts";
import { providerFailure } from "#server/providerFailure.ts";

export function authRouteHandler(auth: MountedAuth, options: MountRouteOptions) {
	const setClientIp = clientIpHeaders(options);
	return Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const web = yield* HttpServerRequest.toWeb(request);
		const clientIp = yield* setClientIp(web);
		yield* Effect.annotateCurrentSpan({
			"auth.rate_limit.address": clientIp.address,
			"auth.rate_limit.address_source": clientIp.source,
		});
		return HttpServerResponse.fromWeb(
			yield* response(auth, web, options).pipe(
				Effect.catchTag("Forbidden", (error) =>
					Effect.succeed(Response.json({ message: error.message }, { status: HttpStatus.fromLiteral("Forbidden") })),
				),
				Effect.catch(providerFailure),
			),
		);
	}).pipe(
		Effect.catchTag("AuthUnavailable", () =>
			Effect.succeed(HttpServerResponse.text("Authentication is temporarily unavailable", { status: HttpStatus.fromLiteral("ServiceUnavailable") })),
		),
	);
}
