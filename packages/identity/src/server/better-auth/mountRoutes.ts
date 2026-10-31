import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type MountedAuth, type MountRouteOptions, response } from "#server/better-auth/adapters/response.ts";
import { providerFailure } from "#server/providerFailure.ts";
import { clientIpHeaders } from "./clientIp.ts";

export function mountRoutes(auth: MountedAuth, options: MountRouteOptions) {
	const setClientIp = clientIpHeaders(options);
	return HttpRouter.use((router) =>
		router.add("*", "/api/auth/*", (request) =>
			Effect.gen(function* () {
				const web = yield* HttpServerRequest.toWeb(request);
				const clientIp = setClientIp(request, web);
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
				Effect.catch(() =>
					Effect.succeed(
						HttpServerResponse.text("Authentication is temporarily unavailable", { status: HttpStatus.fromLiteral("ServiceUnavailable") }),
					),
				),
			),
		),
	);
}
