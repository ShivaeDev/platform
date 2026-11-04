import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import { isSensitiveKey } from "@shivaedev/errors/sensitive.ts";
import type { AppHostFactory } from "#AppHostFactory.ts";
import type { AppHostInput, HostPreflight } from "#AppHostInput.ts";
import { appDatabase, type DatabaseConfig } from "#appDatabase.ts";
import { appHostHttp, deferredHost, migratedHost } from "#appHostHttp.ts";
import type { HostCoreOptions, HostPolicy, HostRouteRequirements, HostRoutes } from "#hostOptions.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { redactingDiagnostics } from "#redactingDiagnostics.ts";

export interface AppDatabaseOptions<R = never, E = never> {
	readonly config?: DatabaseConfig;
	readonly migrations: MigrationOptions<R, E>;
}

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
		readonly policy: "loopback";
		readonly sessions?: never;
	};

export type AppHttpHostOptions<
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> &
	HostPolicy & { readonly migrations?: undefined };
export const appHost: AppHostFactory = <
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
		TMigrationError
	>,
) => {
	const startup = options.preflight;
	const preflight =
		startup === undefined
			? Layer.empty
			: Layer.unwrap(
					Effect.map("application" in options ? Effect.succeed(isSensitiveKey) : hostSensitiveKeys(options), (sensitive) =>
						startup.pipe(Layer.provide(redactingDiagnostics(sensitive))),
					),
				);
	if ("application" in options) {
		return deferredHost(options.application, appDatabase(options)).pipe(Layer.provideMerge(preflight), Layer.provide(NodeCrypto.layer));
	}
	return options.migrations === undefined
		? appHostHttp(options).pipe(Layer.provideMerge(preflight), Layer.provide(NodeCrypto.layer))
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations })).pipe(
				Layer.provideMerge(preflight),
				Layer.provide(NodeCrypto.layer),
			);
};
