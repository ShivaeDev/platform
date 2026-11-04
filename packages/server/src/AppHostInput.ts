import type { Effect } from "effect";
import type { Rpc } from "effect/rpc";
import type { AppDatabaseOptions } from "#appDatabase.ts";
import type { AppHttpHostOptions } from "#appHost.ts";
import type { HostCoreOptions, HostPolicy, HostRouteRequirements, HostRoutes } from "#hostOptions.ts";
import type { HostPreflight } from "#hostPreflight.ts";

export type AppHostInput<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TApplicationError = never,
	TApplicationRequirements = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	(
		| (AppDatabaseOptions<TMigrations, TMigrationError> & {
				readonly application: Effect.Effect<
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
				>;
		  })
		| AppHostOptions<
				TRpcs,
				THandlers,
				THandlerError,
				THandlerRequirements,
				TServices,
				TServiceError,
				TServiceRequirements,
				TMigrations,
				TPreflight,
				TPreflightError,
				TPreflightRequirements,
				TRouteError,
				TRouteRequirements,
				TMigrationError
		  >
		| AppLocalHostOptions<
				TRpcs,
				THandlers,
				THandlerError,
				THandlerRequirements,
				TServices,
				TServiceError,
				TServiceRequirements,
				TMigrations,
				TPreflight,
				TPreflightError,
				TPreflightRequirements,
				TRouteError,
				TRouteRequirements,
				TMigrationError
		  >
		| AppHttpHostOptions<
				TRpcs,
				THandlers,
				THandlerError,
				THandlerRequirements,
				TServices,
				TServiceError,
				TServiceRequirements,
				TPreflight,
				TPreflightError,
				TPreflightRequirements,
				TRouteError,
				TRouteRequirements
		  >
	);

export type AppHostOptions<
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> &
	HostPolicy & {
		readonly migrations: AppDatabaseOptions<TMigrations, TMigrationError>["migrations"];
		readonly config?: AppDatabaseOptions["config"];
		readonly policy?: undefined;
	};

export type AppLocalHostOptions<
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> & {
		readonly migrations: AppDatabaseOptions<TMigrations, TMigrationError>["migrations"];
		readonly config?: AppDatabaseOptions["config"];
		readonly policy: "loopback";
		readonly sessions?: never;
	};
