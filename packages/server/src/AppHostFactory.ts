import type { Rpc } from "effect/rpc";
import type { AppHostInput } from "#AppHostInput.ts";
import type { AppDatabaseOptions } from "#appDatabase.ts";
import type { deferredHost } from "#appDatabaseHttp.ts";
import type { AppHttpHostOptions } from "#appHost.ts";
import type { appHostHttp } from "#appHostHttp.ts";
import type { HostRouteRequirements } from "#hostOptions.ts";
import type { PreflightHost } from "#hostPreflight.ts";

export interface AppHostFactory {
	<
		TRpcs extends Rpc.Any = never,
		THandlers = never,
		THandlerError = never,
		THandlerRequirements = never,
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
		TRequestServices = never,
		TRequestRequirements = never,
	>(
		options: AppHostInput<
			TRpcs,
			THandlers,
			THandlerError,
			THandlerRequirements,
			TServices,
			TServiceError,
			TServiceRequirements,
			TMigrations,
			TApplicationError,
			TApplicationRequirements,
			TPreflight,
			TPreflightError,
			TPreflightRequirements,
			TRouteError,
			TRouteRequirements,
			TMigrationError,
			TRequestServices,
			TRequestRequirements
		> & { readonly migrations: AppDatabaseOptions<TMigrations, TMigrationError>["migrations"] },
	): PreflightHost<
		ReturnType<
			typeof deferredHost<
				TRpcs,
				THandlers,
				THandlerError,
				THandlerRequirements,
				TServices,
				TServiceError,
				TServiceRequirements,
				TMigrations,
				TApplicationError,
				TApplicationRequirements,
				TRouteError,
				TRouteRequirements,
				TMigrationError,
				TRequestServices,
				TRequestRequirements
			>
		>,
		NoInfer<TPreflight>,
		NoInfer<TPreflightError>,
		NoInfer<TPreflightRequirements>
	>;

	<
		TRpcs extends Rpc.Any = never,
		THandlers = never,
		THandlerError = never,
		THandlerRequirements = never,
		TServices = never,
		TServiceError = never,
		TServiceRequirements = never,
		TPreflight = never,
		TPreflightError = never,
		TPreflightRequirements = never,
		TRouteError = never,
		TRouteRequirements = HostRouteRequirements,
		TRequestServices = never,
		TRequestRequirements = never,
	>(
		options: AppHttpHostOptions<
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
			TRouteRequirements,
			TRequestServices,
			TRequestRequirements
		>,
	): PreflightHost<
		ReturnType<
			typeof appHostHttp<
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
			>
		>,
		NoInfer<TPreflight>,
		NoInfer<TPreflightError>,
		NoInfer<TPreflightRequirements>
	>;
}
