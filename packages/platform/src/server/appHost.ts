import { Context, type Effect, Layer } from "effect";
import type { Rpc } from "effect/rpc";
import type { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import type { AppHostFactory } from "#server/AppHostFactory.ts";
import type { AppHostInput, HostPreflight } from "#server/AppHostInput.ts";
import { appHostHttp, deferredHost, migratedHost } from "#server/appHostHttp.ts";
import { type DatabaseConfig, databaseLayer } from "#server/databaseLayer.ts";
import type { HostOptions, HostPolicy } from "#server/hostOptions.ts";
import type { MigrationOptions } from "#server/MigrationOptions.ts";
import type { SessionPolicy, SessionShape } from "#server/rpc-server/session.ts";

export class AppChanges extends Context.Service<AppChanges, Effect.Success<typeof makeLiveServer>>()("@shivaedev/platform/AppChanges") {}
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & {
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & {
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
> = HostPreflight<TPreflight, TPreflightError, TPreflightRequirements> &
	HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
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
		TPreflightRequirements
	>,
) => {
	if ("application" in options) {
		return deferredHost(options.application, appDatabase(options), AppChanges).pipe(Layer.provideMerge(options.preflight ?? Layer.empty));
	}
	return options.migrations === undefined
		? appHostHttp(options, AppChanges).pipe(Layer.provideMerge(options.preflight ?? Layer.empty))
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations }), AppChanges).pipe(
				Layer.provideMerge(options.preflight ?? Layer.empty),
			);
};
