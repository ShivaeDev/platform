import type { Context, Effect, Layer, Scope } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc, RpcClient } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type * as Socket from "effect/socket/Socket";
import type { LiveBound } from "#automaticLive.ts";
import type { Bound } from "#bind.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";

export interface ClientOptions {
	readonly headers?: Readonly<Record<string, string>>;
	readonly live?: boolean;
	readonly protocol?: Layer.Layer<RpcClient.Protocol>;
	readonly url: string;
	readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}

export type ClientService<TName extends string, TRpcs extends Rpc.Any> = Context.ServiceClass.Shape<
	`${TName}/Client`,
	RpcClient.RpcClient.Flat<TRpcs, RpcClientError>
>;

export type MadeClient<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	TStreams extends readonly StreamShape[],
	TExtra extends Rpc.Any,
> = Layer.Layer<ClientService<TName, TRpcs | TExtra>> & {
	readonly api: Bound<TName, TQueries, TCommands, TRpcs, ClientService<TName, TRpcs | TExtra>, TStreams> & LiveBound;
	readonly Client: AtomRpc.AtomRpcClient<ClientService<TName, TRpcs | TExtra>, `${TName}/Client`, TRpcs | TExtra>;
	readonly client: Effect.Effect<RpcClient.RpcClient<TRpcs | TExtra, RpcClientError>, never, Scope.Scope | Rpc.MiddlewareClient<TRpcs | TExtra>>;
	readonly runtime: Atom.AtomRuntime<ClientService<TName, TRpcs | TExtra>>;
};
