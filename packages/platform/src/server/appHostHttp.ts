import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { ByteSize, Config, Effect, Layer } from "effect";
import { HttpEffect, HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse, HttpStaticServer } from "effect/http";
import { type Rpc, RpcSerialization, RpcServer } from "effect/rpc";
import type { Authenticated, MaybeAuthenticated, RequestTracing } from "@shivaedev/identity/middleware.ts";
import { localRpcGuard } from "@shivaedev/identity/server/local.ts";
import { authenticatedLayer, maybeAuthenticatedLayer, type SessionShape } from "@shivaedev/identity/server/session.ts";
import { requestTracingLayer } from "@shivaedev/identity/server/tracing.ts";
import type { AppChanges, AppHttpHostOptions } from "#server/appHost.ts";
import { boundedRpcRequest } from "#server/boundedRpcRequest.ts";
import type { databaseLayer } from "#server/databaseLayer.ts";
import { healthRoute } from "#server/healthRoute.ts";
import { hostChanges } from "#server/hostChanges.ts";
import type { HostOptions, HostPolicy } from "#server/hostOptions.ts";
import { hostTransport } from "#server/hostTransport.ts";
import type { MigrationOptions } from "#server/MigrationOptions.ts";
import { nativeClientOrigins } from "#server/nativeClientOrigins.ts";
import { otlpTracing } from "#server/otlpTracing.ts";
import { RedactionPolicy } from "#server/RedactionPolicy.ts";
import { redactingDiagnostics } from "#server/redactingDiagnostics.ts";
import { redactingRpcSerialization } from "#server/redactingRpcSerialization.ts";
import { schemaSensitiveKeys } from "#server/schemaSensitiveKeys.ts";
import { tracedGroup } from "#server/tracedGroup.ts";

const rpcCacheControl: HttpEffect.PreResponseHandler = (_, response) =>
	Effect.succeed(HttpServerResponse.setHeader(response, "cache-control", "private, no-store"));

export function appHostHttp<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TSession extends SessionShape,
>(
	options: HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & HostPolicy<TSession>,
	changesService: typeof AppChanges,
) {
	const sensitive = schemaSensitiveKeys(options.group, options.config?.sensitiveKeys);
	return Layer.unwrap(
		Effect.gen(function* () {
			const { bodySize, trustedProxy, nativeOrigins } = yield* hostTransport(options);
			const middleware: Layer.Layer<RequestTracing> | Layer.Layer<Authenticated | MaybeAuthenticated | RequestTracing> =
				options.policy === "loopback"
					? requestTracingLayer({ sensitive })
					: Layer.mergeAll(authenticatedLayer(options.sessions), maybeAuthenticatedLayer(options.sessions), requestTracingLayer({ sensitive }));
			const routes = HttpRouter.use((router) =>
				Effect.gen(function* () {
					const wire = redactingRpcSerialization(yield* RpcSerialization.RpcSerialization, sensitive, sensitive.maskFailure);
					const handler = yield* RpcServer.toHttpEffect(tracedGroup(options.group)).pipe(
						Effect.provideService(RpcSerialization.RpcSerialization, wire),
					);
					const guarded = localRpcGuard(handler, trustedProxy, nativeOrigins);
					if (nativeOrigins.length > 0) {
						yield* router.add("OPTIONS", options.rpcPath ?? "/rpc", HttpServerResponse.text("Local same-origin requests only", { status: 403 }));
					}
					yield* router.add("POST", options.rpcPath ?? "/rpc", (request) => {
						HttpEffect.appendPreResponseHandlerUnsafe(request, rpcCacheControl);
						return guarded.pipe(
							Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(bodySize)),
							Effect.provideService(HttpServerRequest.HttpServerRequest, boundedRpcRequest(request)),
							Effect.provideService(RpcSerialization.RpcSerialization, wire),
						);
					});
				}),
			).pipe(
				Layer.provide(Layer.merge(middleware, hostChanges(options.group, changesService).pipe(Layer.provideMerge(options.handlers)))),
				Layer.provide(RpcSerialization.layerNdjson),
				Layer.provide(nativeClientOrigins(nativeOrigins, trustedProxy)),
			);
			const assets =
				options.assets === undefined
					? Layer.empty
					: HttpStaticServer.layer(typeof options.assets === "string" ? { root: options.assets } : options.assets);
			const application = Layer.mergeAll(options.services ?? Layer.empty);
			const server = Layer.unwrap(
				Effect.gen(function* () {
					const port = options.config?.port ?? (yield* Config.Int("PORT").pipe(Config.withDefault(3000)));
					const host = options.config?.host ?? (yield* Config.String("HOST").pipe(Config.withDefault("127.0.0.1")));
					return NodeHttpServer.layer(createServer, {
						gracefulShutdownTimeout: options.config?.gracefulShutdownTimeout,
						host,
						port,
						...(options.config?.disablePreemptiveShutdown === undefined
							? {}
							: { disablePreemptiveShutdown: options.config.disablePreemptiveShutdown }),
					});
				}),
			);
			const applicationRoutes = (options.routes ?? Layer.empty).pipe(
				Layer.provide(options.nativeOrigins === undefined ? Layer.empty : nativeClientOrigins(nativeOrigins, trustedProxy, true)),
			);
			return HttpRouter.serve(Layer.mergeAll(routes, healthRoute, assets, applicationRoutes), { disableLogger: true }).pipe(
				Layer.provideMerge(application),
				Layer.provideMerge(server),
				Layer.provide(NodeServices.layer),
			);
		}),
	).pipe(Layer.provide(redactingDiagnostics(sensitive)), Layer.provide(otlpTracing), Layer.provide(Layer.succeed(RedactionPolicy, sensitive)));
}

export function migratedHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
>(
	options: HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
		HostPolicy<TSession> & { readonly migrations: MigrationOptions<TMigrations> },
	database: ReturnType<typeof databaseLayer<TMigrations>>,
	changesService: typeof AppChanges,
) {
	const services = Layer.mergeAll(options.services ?? Layer.empty);
	return appHostHttp({ ...options, services: services.pipe(Layer.provideMerge(database)) }, changesService);
}

export function deferredHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
	TApplicationError,
	TApplicationRequirements,
>(
	application: Effect.Effect<
		AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
		TApplicationError,
		TApplicationRequirements
	>,
	database: ReturnType<typeof databaseLayer<TMigrations>>,
	changesService: typeof AppChanges,
) {
	return Layer.unwrap(Effect.map(application, (options) => appHostHttp(options, changesService))).pipe(Layer.provideMerge(database));
}
