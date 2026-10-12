import { Context, type Duration, type Effect, type Layer, type Redacted } from "effect";
import type { HttpRouter, HttpStaticServer } from "effect/unstable/http";
import type { Rpc, RpcGroup } from "effect/unstable/rpc";
import type { Migrator } from "effect/unstable/sql";
import type { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import type { PostgresChangesOptions } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { SessionPolicy, SessionShape } from "#rpc-server/session.ts";
import { appHostHttp, migratedHost } from "./appHostHttp.ts";
import { databaseLayer } from "./databaseLayer.ts";

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
> extends AppDatabaseOptions<TMigrations> {
	readonly assets?: string | Parameters<typeof HttpStaticServer.layer>[0];
	readonly config?: AppDatabaseOptions<TMigrations>["config"] & {
		readonly port?: number;
		readonly host?: string;
		readonly trustedProxy?: string;
		readonly disablePreemptiveShutdown?: boolean;
	};
	readonly group: RpcGroup.RpcGroup<TRpcs>;
	readonly handlers: Layer.Layer<THandlers, THandlerError, THandlerRequirements>;
	readonly routes?: Layer.Layer<never, never, HttpRouter.HttpRouter>;
	readonly rpcPath?: HttpRouter.PathInput;
	readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements>;
	readonly sessions: SessionPolicy<TSession> | "loopback";
}

export type AppHttpHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TSession extends SessionShape,
> = Omit<
	AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, never, TSession>,
	"migrations"
> & { readonly migrations?: undefined };

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
	options: AppHostOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TMigrations,
		TSession
	>,
): ReturnType<
	typeof migratedHost<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
>;
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
	options: Omit<
		AppHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>,
		"migrations"
	> & { readonly migrations?: undefined },
): ReturnType<
	typeof appHostHttp<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TMigrations, TSession>
>;
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
		| AppHttpHostOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements, TSession>,
) {
	return options.migrations === undefined
		? appHostHttp(options)
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations }));
}
