import type { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { AppDatabaseOptions, AppHostOptions, AppHttpHostOptions, AppLocalHostOptions } from "#server/appHost.ts";
import type { SessionShape } from "#server/rpc-server/session.ts";

export interface HostPreflight<TServices = never, TError = never, TRequirements = never> {
	readonly preflight?: Layer.Layer<TServices, TError, TRequirements>;
}

export type AppHostInput<
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
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
		| AppHttpHostOptions<
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
		  >
	);
