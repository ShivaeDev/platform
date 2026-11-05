import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import type { Rpc } from "effect/rpc";
import { hostHttpServices } from "#adapters/hostHttpServices.ts";
import { nodeHttpServer } from "#adapters/nodeHttpServer.ts";
import { browserErrorRoute } from "#browserErrorRoute.ts";
import { healthRoute } from "#healthRoute.ts";
import { hostApplicationRoutes } from "#hostApplicationRoutes.ts";
import { hostAssets } from "#hostAssets.ts";
import type { HostOptions, HostPolicy, HostRouteRequirements } from "#hostOptions.ts";
import { hostRpcRoutes } from "#hostRpcRoutes.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import { hostTransport } from "#hostTransport.ts";
import { nativeClientOrigins } from "#nativeClientOrigins.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";
import { redactingDiagnostics } from "#redactingDiagnostics.ts";

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
	return Layer.unwrap(
		Effect.map(hostSensitiveKeys(options), (sensitive) =>
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
							Effect.map((handler) => HttpServer.serve(handler).pipe(HttpServer.withLogAddress, Layer.provideMerge(server))),
						),
					).pipe(Layer.provideMerge(application), Layer.provide(sessions), Layer.provideMerge(hostHttpServices));
				}),
			).pipe(Layer.provide(redactingDiagnostics(sensitive)), Layer.provide(otlpTracing), Layer.provide(Layer.succeed(RedactionPolicy, sensitive))),
		),
	);
}
