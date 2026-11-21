import { Context, Effect, Layer, Schema } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerResponse } from "effect/http";
import { NativeOrigins } from "@shivaedev/identity/server/NativeOrigins.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appHost } from "#appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";
import { host } from "#test/app-host/story.ts";

class Metadata extends Context.Service<Metadata, { readonly path: HttpRouter.PathInput; readonly content: string }>()(
	"@shivaedev/server/host-test/Metadata",
) {}

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
	const { nativeOrigins, rpcPath } = options;
	return host.trait("configured", "HTTP routes use application metadata and their own CORS policy", (state) => {
		const shared = {
			config: state.config,
			group: Ping,
			handlers: pingHandlers,
			...(rpcPath === undefined ? {} : { rpcPath }),
			routes: metadataRoutes,
			services: Layer.succeed(Metadata, {
				content: "Public application metadata",
				path: "/.well-known/app",
			}),
		};
		state.build = () =>
			nativeOrigins === undefined
				? appHost({ ...shared, policy: "loopback" })
				: appHost({
						...shared,
						sessions: Layer.succeed(SessionPolicy, {
							...sessions(state.lookups),
							nativeOrigins: Schema.decodeUnknownSync(NativeOrigins)(nativeOrigins),
						}),
					});
	});
}
