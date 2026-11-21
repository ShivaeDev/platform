import { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { appDatabase } from "#appDatabase.ts";
import type { AppHttpHostOptions } from "#appHost.ts";
import { appHostHttp, servedHost } from "#appHostHttp.ts";
import type { HostOptions, HostPolicy, HostRouteRequirements } from "#hostOptions.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { redactedHost } from "#redactedHost.ts";

export function migratedHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
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
		HostPolicy & {
			readonly migrations: MigrationOptions<TMigrations, TMigrationError>;
		},
	database: ReturnType<typeof appDatabase<TMigrations, TMigrationError>>,
) {
	const services = Layer.mergeAll(options.services ?? Layer.empty);
	return appHostHttp({ ...options, services: services.pipe(Layer.provideMerge(database)) });
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
	TApplicationError,
	TApplicationRequirements,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
	TRequestServices = never,
	TRequestRequirements = never,
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
			never,
			never,
			never,
			TRouteError,
			TRouteRequirements,
			TRequestServices,
			TRequestRequirements
		>,
		TApplicationError,
		TApplicationRequirements
	>,
	database: ReturnType<typeof appDatabase<TMigrations, TMigrationError>>,
	configured: { readonly config?: { readonly sensitiveKeys?: readonly string[] } },
) {
	// The application and the database it runs on build inside the host's one policy, which holds the configured names from the start,
	// so whatever they log, fork or capture is masked too.
	return redactedHost(configured, (sensitive) =>
		Layer.unwrap(Effect.flatMap(application, (options) => Effect.as(sensitive.serve(options), servedHost(options, sensitive)))).pipe(
			Layer.provideMerge(database),
		),
	);
}
