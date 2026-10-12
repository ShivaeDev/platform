import type { Layer } from "effect";
import type { HttpRouter, HttpStaticServer } from "effect/unstable/http";
import type { Rpc, RpcGroup } from "effect/unstable/rpc";
import type { SessionPolicy, SessionShape } from "#rpc-server/session.ts";
import type { AppDatabaseOptions } from "./appHost.ts";

export interface HostOptions<TRpcs extends Rpc.Any, THandlers, THandlerError, THandlerRequirements, TServices, TServiceError, TServiceRequirements> {
	readonly assets?: string | Parameters<typeof HttpStaticServer.layer>[0];
	readonly config?: AppDatabaseOptions["config"] & {
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
}

export type HostPolicy<TSession extends SessionShape> =
	| { readonly policy?: undefined; readonly sessions: SessionPolicy<TSession> }
	| { readonly policy: "loopback"; readonly sessions?: never };
