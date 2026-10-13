import { Context, type Duration, type Effect, type Redacted } from "effect";
import type { Rpc } from "effect/rpc";
import type { Migrator } from "effect/sql";
import type { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import type { PostgresChangesOptions } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { SessionPolicy, SessionShape } from "#rpc-server/session.ts";
import { appHostHttp, migratedHost } from "./appHostHttp.ts";
import { databaseLayer } from "./databaseLayer.ts";
import type { HostOptions, HostPolicy } from "./hostOptions.ts";

export class AppChanges extends Context.Service<AppChanges, Effect.Success<typeof makeLiveServer>>()("@shivaedev/platform/AppChanges") {}
export interface AppDatabaseOptions<R = never> {
	readonly config?: {
		readonly databaseUrl?: Redacted.Redacted<string>;
		readonly applicationName?: string;
		readonly maxConnections?: number;
		readonly changes?: Omit<PostgresChangesOptions, "client" | "resync">;
	};
	readonly migrations: {
		readonly loader: Migrator.Loader<R>;
		readonly table?: string;
		readonly lockTimeout?: Duration.Input;
	};
}

export function appDatabase<R>(options: AppDatabaseOptions<R>) {
	return databaseLayer(options, AppChanges);
}

export interface AppHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
> extends HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> {
	readonly migrations: AppDatabaseOptions<TMigrations>["migrations"];
	readonly policy?: undefined;
	readonly sessions: SessionPolicy<TSession>;
}

export type AppLocalHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
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
	TServices,
	TServiceError,
	TServiceRequirements,
	TSession extends SessionShape,
> = HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostPolicy<TSession> & { readonly migrations?: undefined };

export function appHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
>(
	options:
		| AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
		| AppLocalHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations>,
): ReturnType<
	typeof migratedHost<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
>;
export function appHost<TRpcs extends Rpc.Any, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements>(
	options: HostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> & {
		readonly policy: "loopback";
		readonly sessions?: never;
		readonly migrations?: undefined;
	},
): ReturnType<
	typeof appHostHttp<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, SessionShape>
>;
export function appHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TSession extends SessionShape,
>(
	options: AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
): ReturnType<typeof appHostHttp<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>>;
export function appHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
>(
	options:
		| AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
		| AppLocalHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations>
		| AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
) {
	return options.migrations === undefined
		? appHostHttp(options)
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations }));
}
