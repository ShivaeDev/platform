import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { ByteSize, Config, Effect, Layer, Option, Schema } from "effect";
import { HttpEffect, HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse, HttpStaticServer } from "effect/http";
import { type Rpc, RpcSerialization, RpcServer } from "effect/rpc";
import type { Authenticated, MaybeAuthenticated, RequestTracing } from "#rpc/middleware.ts";
import type { AppChanges, AppHttpHostOptions } from "#server/appHost.ts";
import { boundedRpcRequest } from "#server/boundedRpcRequest.ts";
import type { databaseLayer } from "#server/databaseLayer.ts";
import { healthRoute } from "#server/healthRoute.ts";
import { hostChanges } from "#server/hostChanges.ts";
import type { HostOptions, HostPolicy } from "#server/hostOptions.ts";
import type { MigrationOptions } from "#server/MigrationOptions.ts";
import { otlpTracing } from "#server/otlpTracing.ts";
import { RedactionPolicy } from "#server/RedactionPolicy.ts";
import { redactingDiagnostics } from "#server/redactingDiagnostics.ts";
import { redactingRpcSerialization } from "#server/redactingRpcSerialization.ts";
import { localRpcGuard } from "#server/rpc-server/local.ts";
import { authenticatedLayer, maybeAuthenticatedLayer, type SessionShape } from "#server/rpc-server/session.ts";
import { requestTracingLayer } from "#server/rpc-server/tracing.ts";
import { TrustedProxy } from "#server/rpc-server/trustedProxy.ts";
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
			const maxBodySize = options.config?.maxBodySize ?? (yield* Config.Int("MAX_BODY_SIZE").pipe(Config.withDefault(1024 * 1024)));
			const bodySize = yield* Schema.decodeUnknownEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))(maxBodySize).pipe(
				Effect.mapError((cause) => new Config.ConfigError(cause)),
			);
			const trustedProxy =
				options.policy === "loopback"
					? undefined
					: (options.config?.trustedProxy ?? Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option)));
			if (trustedProxy !== undefined) {
				yield* Schema.decodeUnknownEffect(TrustedProxy)(trustedProxy).pipe(Effect.mapError((cause) => new Config.ConfigError(cause)));
			}
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
					const guarded = localRpcGuard(handler, trustedProxy);
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
						host,
						port,
						...(options.config?.disablePreemptiveShutdown === undefined
							? {}
							: { disablePreemptiveShutdown: options.config.disablePreemptiveShutdown }),
					});
				}),
			);
			return HttpRouter.serve(Layer.mergeAll(routes, healthRoute, assets, options.routes ?? Layer.empty), { disableLogger: true }).pipe(
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
