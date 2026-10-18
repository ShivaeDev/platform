import type { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { HostPreflight } from "#server/AppHostInput.ts";
import type { AppDatabaseOptions, AppHostOptions, AppHttpHostOptions, AppLocalHostOptions } from "#server/appHost.ts";
import type { appHostHttp, deferredHost } from "#server/appHostHttp.ts";
import type { SessionShape } from "#server/rpc-server/session.ts";

type PreflightHost<THost extends Layer.Any, TServices, TError, TRequirements> = Layer.Layer<
	Layer.Success<THost> | TServices,
	Layer.Error<THost> | TError,
	Exclude<Layer.Services<THost>, TServices> | TRequirements
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
	>(
		options: HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
			(
				| (AppDatabaseOptions<TMigrations> & {
						readonly application: Effect.Effect<
							AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
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
						TSession,
						TPreflight,
						TPreflightError,
						TPreflightRequirements
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
						TPreflightRequirements
				  >
			),
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
				TApplicationRequirements
			>
		>,
		TPreflight,
		TPreflightError,
		TPreflightRequirements
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
			TPreflightRequirements
		>,
	): PreflightHost<
		ReturnType<typeof appHostHttp<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>>,
		TPreflight,
		TPreflightError,
		TPreflightRequirements
	>;
}
