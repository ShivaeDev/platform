import { Context, type Effect } from "effect";
import type { Rpc } from "effect/rpc";
import type { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { appHostHttp, deferredHost, migratedHost } from "#server/appHostHttp.ts";
import { type DatabaseConfig, databaseLayer } from "#server/databaseLayer.ts";
import type { HostOptions, HostPolicy } from "#server/hostOptions.ts";
import type { SessionPolicy, SessionShape } from "#server/rpc-server/session.ts";
import type { MigrationOptions } from "./MigrationOptions.ts";

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
> = HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & {
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
> = HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & {
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
> = HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostPolicy<TSession> & { readonly migrations?: undefined };

export function appHost<
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
>(
	options:
		| (AppDatabaseOptions<TMigrations> & {
				readonly application: Effect.Effect<
					AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
					TApplicationError,
					TApplicationRequirements
				>;
		  })
		| AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
		| AppLocalHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations>,
): ReturnType<
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
>;

export function appHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TSession extends SessionShape = SessionShape,
>(
	options: AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
): ReturnType<typeof appHostHttp<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>>;
export function appHost<
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
>(
	options:
		| (AppDatabaseOptions<TMigrations> & {
				readonly application: Effect.Effect<
					AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
					TApplicationError,
					TApplicationRequirements
				>;
		  })
		| AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
		| AppLocalHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations>
		| AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
) {
	if ("application" in options) {
		return deferredHost(options.application, appDatabase(options));
	}
	return options.migrations === undefined
		? appHostHttp(options)
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations }));
}
