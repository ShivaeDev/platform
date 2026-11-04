import { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { appDatabase } from "#appDatabase.ts";
import type { AppHttpHostOptions } from "#appHost.ts";
import { appHostHttp } from "#appHostHttp.ts";
import type { HostOptions, HostPolicy, HostRouteRequirements } from "#hostOptions.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

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
			TRouteRequirements
		>,
		TApplicationError,
		TApplicationRequirements
	>,
	database: ReturnType<typeof appDatabase<TMigrations, TMigrationError>>,
) {
	return Layer.unwrap(Effect.map(application, (options) => appHostHttp(options))).pipe(Layer.provideMerge(database));
}
