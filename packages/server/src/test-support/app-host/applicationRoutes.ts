import { Context, Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http";
import { appHost } from "#appHost.ts";
import { Ping, pingHandlers } from "./ping.ts";
import { host } from "./story.ts";

class Metadata extends Context.Service<Metadata, { readonly path: HttpRouter.PathInput; readonly content: string }>()("host-test/Metadata") {}

const metadataRoutes = Layer.merge(
	Layer.unwrap(
		Effect.map(Metadata, ({ path }) => HttpRouter.add("*", path, Metadata.pipe(Effect.map(({ content }) => HttpServerResponse.text(content))))),
	).pipe(
		Layer.provide(
			HttpRouter.middleware(
				HttpMiddleware.cors({
					allowedMethods: ["GET"],
					allowedOrigins: ["*"],
				}),
			).layer,
		),
	),
	HttpRouter.add("*", "/api/auth/*", HttpServerResponse.text("Auth route")),
);

export function applicationRoutes(options: { readonly nativeOrigins?: readonly string[]; readonly rpcPath?: HttpRouter.PathInput } = {}) {
	return host.trait("configured", "HTTP routes use application metadata and their own CORS policy", (state) => {
		state.build = () =>
			appHost({
				...options,
				config: state.config,
				group: Ping,
				handlers: pingHandlers,
				policy: "loopback",
				routes: metadataRoutes,
				services: Layer.succeed(Metadata, {
					content: "Public application metadata",
					path: "/.well-known/app",
				}),
			});
	});
}
