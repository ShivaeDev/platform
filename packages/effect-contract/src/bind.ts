import type { Duration, Schema } from "effect";
import { Effect, Stream } from "effect";
import type { Headers } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { automaticLive, type LiveBound, LiveConnection } from "./automaticLive.ts";
import type { Contract, Declared, Tag } from "./contract.ts";
import { invalidationKeys, type Key, readKeys } from "./keys.ts";
import type { CommandShape, QueryShape, StreamShape } from "./operation.ts";

export type Failure<R extends Rpc.Any> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer TMiddleware, infer _Requires>
		? Rpc.ErrorExit<R> | TMiddleware["error"]["Type"] | RpcClientError
		: never;

export type RunFailure<R extends Rpc.Any> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer TMiddleware, infer _Requires>
		? Failure<R> | TMiddleware["~ClientError"]
		: never;

export interface QueryOptions {
	readonly headers?: Headers.Input;
	readonly serializationKey?: string;
	readonly timeToLive?: Duration.Input;
}

export interface BoundQuery<R extends Rpc.Any, TSelf> {
	readonly query: (payload: Rpc.Payload<R>, options?: QueryOptions) => Atom.Atom<AsyncResult.AsyncResult<Rpc.Success<R>, Failure<R>>>;
	readonly run: (payload: Rpc.Payload<R>) => Effect.Effect<Rpc.Success<R>, RunFailure<R>, TSelf>;
}

export interface BoundCommand<R extends Rpc.Any, TSelf> {
	readonly run: (payload: Rpc.Payload<R>) => Effect.Effect<Rpc.Success<R>, RunFailure<R>, TSelf | Reactivity.Reactivity>;
}

export interface BoundStream<R extends Rpc.Any, TSelf> {
	readonly run: (payload: Rpc.Payload<R>) => Stream.Stream<Rpc.SuccessChunk<R>, RunFailure<R>, TSelf | Rpc.ServicesClient<R>>;
}

export type Bound<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	TSelf,
	TStreams extends readonly StreamShape[] = readonly [],
> = {
	readonly [TQuery in TQueries[number] as TQuery["name"]]: BoundQuery<Rpc.ExtractTag<TRpcs, Tag<TName, TQuery["name"]>>, TSelf>;
} & {
	readonly [TCommand in TCommands[number] as TCommand["name"]]: BoundCommand<Rpc.ExtractTag<TRpcs, Tag<TName, TCommand["name"]>>, TSelf>;
} & {
	readonly [TStream in TStreams[number] as TStream["name"]]: BoundStream<Rpc.ExtractTag<TRpcs, Tag<TName, TStream["name"]>>, TSelf>;
};

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

type ErasedStreamingClient = AtomRpc.AtomRpcClient<
	unknown,
	string,
	Rpc.Rpc<string, Schema.Top, RpcSchema.Stream<Schema.Top, Schema.Top>, Schema.Never>
>;

type MatchingClient<TRpcs extends Rpc.Any, TClientRpcs extends Rpc.Any> = [TRpcs] extends [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>]
	? [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>] extends [TRpcs]
		? unknown
		: "Client must preserve the contract RPC types"
	: "Client must implement the contract RPCs";

const invalidateAfter = Effect.fn("EffectContract.invalidateAfter")(function* (keys: readonly Key[]) {
	yield* Reactivity.invalidate(invalidationKeys(keys));
});

function boundQuery(service: ErasedClient, tag: string, query: QueryShape, track: (keys: readonly Key[]) => void) {
	function reads(payload: unknown) {
		return readKeys(query.reads(payload));
	}
	return {
		query: (payload: unknown, options: QueryOptions = {}) => {
			track(query.reads(payload));
			return service.query(tag, payload, { ...options, reactivityKeys: reads(payload) });
		},
		run: (payload: unknown) => service.use((client) => client(tag, payload)),
	};
}

function boundCommand(service: ErasedClient, tag: string, command: CommandShape) {
	return {
		run: (payload: unknown) =>
			service.use((client) => client(tag, payload)).pipe(Effect.tap((result) => invalidateAfter(command.invalidates(payload, result)))),
	};
}

function boundStream(service: ErasedStreamingClient, tag: string) {
	return {
		run: (payload: unknown) => Stream.unwrap(service.use((client) => Effect.succeed(client(tag, payload)))),
	};
}

export function bind<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	TSelf,
	TId extends string,
	TClientRpcs extends Rpc.Any,
	TStreams extends readonly StreamShape[],
>(
	contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams>,
	service: AtomRpc.AtomRpcClient<TSelf, TId, TClientRpcs> & MatchingClient<NoInfer<TRpcs>, TClientRpcs>,
): Bound<TName, TQueries, TCommands, TRpcs, TSelf, TStreams> & LiveBound;
export function bind(
	contract: { readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[]> },
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
): unknown {
	const { name, queries, commands, streams } = contract.declaration;
	const automatic = automaticLive(service, name);
	return Object.assign(
		Object.fromEntries([
			...queries.map((query) => [query.name, boundQuery(service, `${name}.${query.name}`, query, automatic.track)] as const),
			...commands.map((command) => [command.name, boundCommand(service, `${name}.${command.name}`, command)] as const),
			...streams.map((stream) => [stream.name, boundStream(service, `${name}.${stream.name}`)] as const),
		]),
		{ [LiveConnection]: automatic.subscription },
	);
}
