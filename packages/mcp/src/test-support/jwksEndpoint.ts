import { toIncomingMessage } from "@effect/platform-node/NodeHttpServerRequest";
import { Effect, Layer, Logger, References } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import type { tokenSigner } from "#test/tokenSigner.ts";

export function jwksEndpoint(
	auth: { readonly api: { readonly getJwks: () => Promise<{ readonly keys: readonly object[] }> } },
	jwk: ReturnType<typeof tokenSigner>["jwk"],
) {
	async function keys() {
		return { keys: [...(await auth.api.getJwks()).keys, jwk] };
	}
	const state: { failure?: "unavailable" | "unreachable" } = {};
	const logs: unknown[][] = [];
	const logger = Logger.layer([
		Logger.make(({ logLevel, message }) => {
			if (logLevel === "Error" || logLevel === "Warn") {
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
				: Effect.promise(keys).pipe(Effect.map(HttpServerResponse.jsonUnsafe));
		}),
	);
	return { keys, logger: Layer.merge(logger, Layer.succeed(References.MinimumLogLevel, "All")), logs, routes, state };
}
