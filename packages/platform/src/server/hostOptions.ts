import type { Duration, Layer } from "effect";
import type { HttpRouter, HttpStaticServer } from "effect/http";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { SessionPolicy, SessionShape } from "#server/rpc-server/session.ts";
import type { AppDatabaseOptions } from "./appHost.ts";

export type HostOptions<TRpcs extends Rpc.Any, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> = {
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
	readonly routes?: Layer.Layer<never, never, HttpRouter.HttpRouter | HttpRouter.Request<"Error", unknown>>;
	readonly rpcPath?: HttpRouter.PathInput;
} & (
	| { readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements> }
	| ([TServices | TServiceError | TServiceRequirements] extends [never] ? { readonly services?: never } : never)
);

export type HostPolicy<TSession extends SessionShape> =
	| { readonly policy?: undefined; readonly sessions: SessionPolicy<TSession> }
	| { readonly policy: "loopback"; readonly sessions?: never };
