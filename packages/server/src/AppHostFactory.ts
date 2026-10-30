import type { Crypto, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { SessionShape } from "@shivaedev/identity/server/session.ts";
import type { AppHostInput } from "#AppHostInput.ts";
import type { AppDatabaseOptions, AppHttpHostOptions } from "#appHost.ts";
import type { appHostHttp, deferredHost } from "#appHostHttp.ts";
import type { HostRouteRequirements } from "#hostOptions.ts";

type PreflightHost<THost extends Layer.Any, TServices, TError, TRequirements> = Layer.Layer<
	Layer.Success<THost> | TServices,
	Layer.Error<THost> | TError,
	Exclude<Layer.Services<THost>, TServices | Crypto.Crypto> | Exclude<TRequirements, Crypto.Crypto>
>;

export interface AppHostFactory {
	<
		TRpcs extends Rpc.Any,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices = never,
		TServiceError = never,
		TServiceRequirements = never,
		TMigrations = never,
		TSession extends SessionShape = SessionShape,
		TApplicationError = never,
		TApplicationRequirements = never,
		TPreflight = never,
		TPreflightError = never,
		TPreflightRequirements = never,
		TRouteError = never,
		TRouteRequirements = HostRouteRequirements,
		TMigrationError = never,
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
			TSession,
			TApplicationError,
			TApplicationRequirements,
			TPreflight,
			TPreflightError,
			TPreflightRequirements,
			TRouteError,
			TRouteRequirements,
			TMigrationError
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
				TSession,
				TApplicationError,
				TApplicationRequirements,
				TRouteError,
				TRouteRequirements,
				TMigrationError
			>
		>,
		NoInfer<TPreflight>,
		NoInfer<TPreflightError>,
		NoInfer<TPreflightRequirements>
	>;

	<
		TRpcs extends Rpc.Any,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices = never,
		TServiceError = never,
		TServiceRequirements = never,
		TSession extends SessionShape = SessionShape,
		TPreflight = never,
		TPreflightError = never,
		TPreflightRequirements = never,
		TRouteError = never,
		TRouteRequirements = HostRouteRequirements,
	>(
		options: AppHttpHostOptions<
			TRpcs,
			THandlers,
			THandlerError,
			THandlerRequirements,
			TServices,
			TServiceError,
			TServiceRequirements,
			TSession,
			TPreflight,
			TPreflightError,
			TPreflightRequirements,
			TRouteError,
			TRouteRequirements
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
				TSession,
				TRouteError,
				TRouteRequirements
			>
		>,
		NoInfer<TPreflight>,
		NoInfer<TPreflightError>,
		NoInfer<TPreflightRequirements>
	>;
}
