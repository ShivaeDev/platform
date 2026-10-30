import { toIncomingMessage } from "@effect/platform-node/NodeHttpServerRequest";
import { Effect, Layer, Logger, References } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

export function jwksEndpoint(auth: { readonly handler: (request: Request) => Promise<Response> }) {
	const state: { failure?: "unavailable" | "unreachable" } = {};
	const logs: unknown[][] = [];
	const logger = Logger.layer([
		Logger.make(({ logLevel, message }) => {
			if (logLevel === "Error") {
				logs.push(Array.isArray(message) ? message : [message]);
			}
		}),
	]);
	const routes = HttpRouter.use((router) =>
		router.add("GET", "/api/auth/jwks", (request) => {
			if (state.failure === "unreachable") {
				return Effect.sync(() => {
					toIncomingMessage(request).destroy();
					return HttpServerResponse.empty();
				});
			}
			return state.failure === "unavailable"
				? Effect.succeed(HttpServerResponse.jsonUnsafe({ message: "JWKS unavailable token=jwks-story-secret" }, { status: 503 }))
				: HttpServerRequest.toWeb(request).pipe(
						Effect.flatMap((web) => Effect.promise(() => auth.handler(web))),
						Effect.map(HttpServerResponse.fromWeb),
					);
		}),
	);
	return { logger: Layer.merge(logger, Layer.succeed(References.MinimumLogLevel, "All")), logs, routes, state };
}
