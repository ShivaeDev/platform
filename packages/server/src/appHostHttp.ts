import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import type { Rpc } from "effect/rpc";
import { nodeHttpServer } from "#adapters/nodeHttpServer.ts";
import { browserErrorRoute } from "#browserErrorRoute.ts";
import { healthRoute } from "#healthRoute.ts";
import { hostApplicationRoutes } from "#hostApplicationRoutes.ts";
import { hostAssets } from "#hostAssets.ts";
import { hostHttpServices } from "#hostHttpServices.ts";
import type { HostOptions, HostPolicy, HostRouteRequirements } from "#hostOptions.ts";
import { hostRpcRoutes } from "#hostRpcRoutes.ts";
import { hostTransport } from "#hostTransport.ts";
import { nativeClientOrigins } from "#nativeClientOrigins.ts";
import { redactedHost } from "#redactedHost.ts";

export function appHostHttp<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TRequestServices = never,
	TRequestRequirements = never,
>(
	options: HostOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TRouteError,
		TRouteRequirements,
		TRequestServices,
		TRequestRequirements
	> &
		HostPolicy,
) {
	const assets = options.assets === undefined ? Layer.empty : hostAssets(options.assets);
	return redactedHost(options, (sensitive) =>
		Layer.unwrap(
			Effect.gen(function* () {
				const transport = yield* hostTransport(options);
				const { bodySize, host, trustedProxy, nativeOrigins } = transport;
				const routes = options.group === undefined ? Layer.empty : hostRpcRoutes(options, transport, sensitive);
				const application = Layer.mergeAll(options.services ?? Layer.empty);
				const sessions = Layer.mergeAll(Layer.empty, ...(options.sessions === undefined ? [] : [options.sessions]));
				const server = nodeHttpServer(host, { ...options.config, maxBodySize: bodySize });
				const applicationRoutes = hostApplicationRoutes(options.routes, bodySize);
				const httpRoutes = Layer.mergeAll(
					routes,
					healthRoute,
					browserErrorRoute(trustedProxy, options.browserErrors),
					assets,
					applicationRoutes,
				).pipe(
					Layer.provide(options.group === undefined ? Layer.empty : nativeClientOrigins(nativeOrigins, trustedProxy, false, options.rpcPath)),
					Layer.provide(nativeClientOrigins(nativeOrigins, trustedProxy, options.nativeOrigins === undefined ? "preflight" : true)),
				);
				return Layer.unwrap(
					HttpRouter.toHttpEffect(httpRoutes).pipe(
						// Building the routes built every repository, so the policy is complete before the server takes a request.
						Effect.tap(() => sensitive.complete),
						Effect.map((handler) => HttpServer.serve(handler).pipe(HttpServer.withLogAddress, Layer.provideMerge(server))),
					),
				).pipe(Layer.provideMerge(application), Layer.provide(sessions), Layer.provideMerge(hostHttpServices));
			}),
		),
	);
}
