import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer, HttpStaticServer } from "effect/http";
import type { Rpc } from "effect/rpc";
import type { SessionShape } from "@shivaedev/identity/server/session.ts";
import type { AppChanges, AppHttpHostOptions } from "#appHost.ts";
import type { databaseLayer } from "#databaseLayer.ts";
import { healthRoute } from "#healthRoute.ts";
import { hostApplicationRoutes } from "#hostApplicationRoutes.ts";
import type { HostOptions, HostPolicy, HostRouteRequirements } from "#hostOptions.ts";
import { hostRpcRoutes } from "#hostRpcRoutes.ts";
import { hostTransport } from "#hostTransport.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { nativeClientOrigins } from "#nativeClientOrigins.ts";
import { nodeHttpServer } from "#nodeHttpServer.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";
import { redactingDiagnostics } from "#redactingDiagnostics.ts";
import { schemaSensitiveKeys } from "#schemaSensitiveKeys.ts";

export function appHostHttp<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TSession extends SessionShape,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
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
		TRouteRequirements
	> &
		HostPolicy<TSession>,
	changesService: typeof AppChanges,
) {
	const sensitive = schemaSensitiveKeys(options.group, options.config?.sensitiveKeys);
	return Layer.unwrap(
		Effect.gen(function* () {
			const transport = yield* hostTransport(options);
			const { bodySize, host, trustedProxy, nativeOrigins } = transport;
			const routes = hostRpcRoutes(options, changesService, transport, sensitive);
			const assets =
				options.assets === undefined
					? Layer.empty
					: HttpStaticServer.layer(typeof options.assets === "string" ? { root: options.assets } : options.assets);
			const application = Layer.mergeAll(options.services ?? Layer.empty);
			const server = nodeHttpServer(host, options.config);
			const applicationRoutes = hostApplicationRoutes(options.routes, bodySize);
			const httpRoutes = Layer.mergeAll(routes, healthRoute, assets, applicationRoutes).pipe(
				Layer.provide(nativeClientOrigins(nativeOrigins, trustedProxy, false, options.rpcPath)),
				Layer.provide(nativeClientOrigins(nativeOrigins, trustedProxy, options.nativeOrigins === undefined ? "preflight" : true)),
			);
			return Layer.unwrap(
				HttpRouter.toHttpEffect(httpRoutes).pipe(
					Effect.map((handler) => HttpServer.serve(handler).pipe(HttpServer.withLogAddress, Layer.provideMerge(server))),
				),
			).pipe(Layer.provideMerge(application), Layer.provideMerge(NodeHttpServer.layerHttpServices));
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
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
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
		TRouteRequirements
	> &
		HostPolicy<TSession> & {
			readonly migrations: MigrationOptions<TMigrations, TMigrationError>;
		},
	database: ReturnType<typeof databaseLayer<TMigrations, TMigrationError>>,
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
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
>(
	application: Effect.Effect<
		AppHttpHostOptions<
			TRpcs,
			THandlers,
			THandlerError,
			THandlerRequirements,
			TServices,
			TServiceError,
			TServiceRequirements,
			TSession,
			never,
			never,
			never,
			TRouteError,
			TRouteRequirements
		>,
		TApplicationError,
		TApplicationRequirements
	>,
	database: ReturnType<typeof databaseLayer<TMigrations, TMigrationError>>,
	changesService: typeof AppChanges,
) {
	return Layer.unwrap(Effect.map(application, (options) => appHostHttp(options, changesService))).pipe(Layer.provideMerge(database));
}
