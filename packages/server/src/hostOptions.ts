import type { Duration, Layer } from "effect";
import type { HttpRouter } from "effect/http";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { AssetOptions } from "#AssetOptions.ts";
import type { AppDatabaseOptions } from "#appHost.ts";
import type { BrowserErrorOptions } from "#browserErrorRoute.ts";

export type HostRouteRequirements = HttpRouter.HttpRouter | HttpRouter.Request<"Error", unknown>;

export type HostCoreOptions<TRpcs extends Rpc.Any, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> = {
	readonly assets?: string | AssetOptions;
	readonly browserErrors?: BrowserErrorOptions;
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

export type HostPolicy =
	| { readonly policy?: undefined; readonly sessions: Layer.Layer<SessionPolicy> }
	| { readonly policy: "loopback"; readonly sessions?: never };
