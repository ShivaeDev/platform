import type { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { SessionShape } from "@shivaedev/identity/server/session.ts";
import type { AppDatabaseOptions, AppHostOptions, AppHttpHostOptions, AppLocalHostOptions } from "#appHost.ts";
import type { HostRouteRequirements } from "#hostOptions.ts";

export type HostPreflight<TServices = never, TError = never, TRequirements = never> =
	| { readonly preflight: Layer.Layer<TServices, TError, TRequirements> }
	| ([TServices | TError | TRequirements] extends [never] ? { readonly preflight?: never } : never);

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
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	(
		| (AppDatabaseOptions<TMigrations> & {
				readonly application: Effect.Effect<
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
				TPreflightRequirements,
				TRouteError,
				TRouteRequirements
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
				TRouteRequirements
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
				TPreflightRequirements,
				TRouteError,
				TRouteRequirements
		  >
	);
