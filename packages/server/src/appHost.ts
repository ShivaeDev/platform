import { NodeCrypto } from "@effect/platform-node";
import { Context, type Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import type { SessionPolicy, SessionShape } from "@shivaedev/identity/server/session.ts";
import type { AppHostFactory } from "#AppHostFactory.ts";
import type { AppHostInput, HostPreflight } from "#AppHostInput.ts";
import { appHostHttp, deferredHost, migratedHost } from "#appHostHttp.ts";
import { type DatabaseConfig, databaseLayer } from "#databaseLayer.ts";
import type { HostCoreOptions, HostPolicy, HostRouteRequirements, HostRoutes } from "#hostOptions.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

export class AppChanges extends Context.Service<AppChanges, Effect.Success<typeof makeLiveServer>>()("@shivaedev/server/AppChanges") {}
export interface AppDatabaseOptions<R = never> {
	readonly config?: DatabaseConfig;
	readonly migrations: MigrationOptions<R>;
}

export function appDatabase<R>(options: AppDatabaseOptions<R>) {
	return databaseLayer(options, AppChanges);
}

export type AppHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TSession extends SessionShape = SessionShape,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> & {
		readonly migrations: AppDatabaseOptions<TMigrations>["migrations"];
		readonly policy?: undefined;
		readonly sessions: SessionPolicy<TSession>;
	};

export type AppLocalHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> & {
		readonly migrations: AppDatabaseOptions<TMigrations>["migrations"];
		readonly policy: "loopback";
		readonly sessions?: never;
	};

export type AppHttpHostOptions<
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements> &
	HostPolicy<TSession> & { readonly migrations?: undefined };
export const appHost: AppHostFactory = <
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
		TRouteRequirements
	>,
) => {
	if ("application" in options) {
		return deferredHost(options.application, appDatabase(options), AppChanges).pipe(
			Layer.provideMerge(options.preflight ?? Layer.empty),
			Layer.provide(NodeCrypto.layer),
		);
	}
	return options.migrations === undefined
		? appHostHttp(options, AppChanges).pipe(Layer.provideMerge(options.preflight ?? Layer.empty), Layer.provide(NodeCrypto.layer))
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations }), AppChanges).pipe(
				Layer.provideMerge(options.preflight ?? Layer.empty),
				Layer.provide(NodeCrypto.layer),
			);
};
