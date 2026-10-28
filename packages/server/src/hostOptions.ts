import type { Duration, Layer } from "effect";
import type { HttpRouter, HttpStaticServer } from "effect/http";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { SessionPolicy, SessionShape } from "@shivaedev/identity/server/session.ts";
import type { AppDatabaseOptions } from "./appHost.ts";

export type HostRouteRequirements = HttpRouter.HttpRouter | HttpRouter.Request<"Error", unknown>;

export type HostCoreOptions<TRpcs extends Rpc.Any, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> = {
	readonly assets?: string | Parameters<typeof HttpStaticServer.layer>[0];
	readonly config?: AppDatabaseOptions["config"] & {
		readonly port?: number;
		readonly host?: string;
		readonly trustedProxy?: string;
		readonly maxBodySize?: number;
		readonly sensitiveKeys?: readonly string[];
		readonly disablePreemptiveShutdown?: boolean;
		readonly gracefulShutdownTimeout?: Duration.Input;
	};
	readonly group: RpcGroup.RpcGroup<TRpcs>;
	readonly handlers: Layer.Layer<THandlers, THandlerError, THandlerRequirements>;
	readonly nativeOrigins?: readonly string[];
	readonly rpcPath?: HttpRouter.PathInput;
} & (
	| { readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements> }
	| ([TServices | TServiceError | TServiceRequirements] extends [never] ? { readonly services?: never } : never)
);

export interface HostRoutes<TRouteError = never, TRouteRequirements = HostRouteRequirements> {
	readonly routes?: Layer.Layer<never, TRouteError, TRouteRequirements>;
}

export type HostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
> = HostCoreOptions<TRpcs, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> &
	HostRoutes<TRouteError, TRouteRequirements>;

export type HostPolicy<TSession extends SessionShape> =
	| { readonly policy?: undefined; readonly sessions: SessionPolicy<TSession> }
	| { readonly policy: "loopback"; readonly sessions?: never };
