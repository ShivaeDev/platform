import type { Duration, Effect, Layer, Stream } from "effect";
import type { Headers } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { automaticLive, type LiveBound, LiveConnection } from "#automaticLive.ts";
import type { ClientOptions, MadeClient } from "#clientOptions.ts";
import type { Contract, Declared, Tag } from "#contract.ts";
import { bindingOwner } from "#internal/bindingOwner.ts";
import { clientOperations } from "#internal/clientOperations.ts";
import { type RpcSource, rpcClient } from "#internal/rpcClient.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import type { ResumeSource, ResumeWindow } from "#resume.ts";

export type Failure<R extends Rpc.Any> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer TMiddleware, infer _Requires>
		? Rpc.ErrorExit<R> | TMiddleware["error"]["Type"] | TMiddleware["~ClientError"] | RpcClientError
		: never;

export type RunFailure<R extends Rpc.Any> = Failure<R>;

export interface QueryOptions {
	readonly headers?: Headers.Input;
	readonly serializationKey?: string;
	readonly timeToLive?: Duration.Input;
}

export interface BoundQuery<R extends Rpc.Any, TSelf, TSubscription extends Rpc.Any = never> {
	readonly query: (payload: Rpc.Payload<R>, options?: QueryOptions) => Atom.Atom<AsyncResult.AsyncResult<Rpc.Success<R>, Failure<R | TSubscription>>>;
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
	readonly [TQuery in TQueries[number] as TQuery["name"]]: BoundQuery<
		Rpc.ExtractTag<TRpcs, Tag<TName, TQuery["name"]>>,
		TSelf,
		Rpc.ExtractTag<TRpcs, Tag<TName, "$changes">>
	>;
} & {
	readonly [TCommand in TCommands[number] as TCommand["name"]]: BoundCommand<Rpc.ExtractTag<TRpcs, Tag<TName, TCommand["name"]>>, TSelf>;
} & {
	readonly [TStream in TStreams[number] as TStream["name"]]: BoundStream<Rpc.ExtractTag<TRpcs, Tag<TName, TStream["name"]>>, TSelf>;
};

type MatchingClient<TRpcs extends Rpc.Any, TClientRpcs extends Rpc.Any> = [TRpcs] extends [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>]
	? [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>] extends [TRpcs]
		? unknown
		: "Client must preserve the contract RPC types"
	: "Client must implement the contract RPCs";

interface BindOptions {
	readonly live?: boolean;
	readonly registry?: AtomRegistry.AtomRegistry;
	readonly resume?: ResumeSource;
	readonly resumeWindow?: ResumeWindow;
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
	TScope extends "session" | undefined,
>(
	contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams, TScope>,
	service: AtomRpc.AtomRpcClient<TSelf, TId, TClientRpcs> & MatchingClient<NoInfer<TRpcs>, TClientRpcs>,
	...options: "session" extends TScope ? [options: BindOptions & { readonly registry: AtomRegistry.AtomRegistry }] : [options?: BindOptions]
): Bound<TName, TQueries, TCommands, TRpcs, TSelf, TStreams> & LiveBound;
export function bind(
	contract: { readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined> },
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	options?: BindOptions,
): unknown {
	return bindApi(contract, service, options);
}

function bindApi(
	contract: { readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined> },
	service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>,
	options?: BindOptions,
) {
	const { name, queries, commands, streams, keyScope } = contract.declaration;
	const owner = bindingOwner(keyScope, options?.registry);
	const automatic = automaticLive(service, name, owner, options?.resume, options?.live, options?.resumeWindow);
	const operations = clientOperations(service, automatic, owner);
	return Object.assign(
		Object.fromEntries([
			...queries.map((query) => [query.name, operations.query(`${name}.${query.name}`, query)] as const),
			...commands.map((command) => [command.name, operations.command(`${name}.${command.name}`, command)] as const),
			...streams.map((stream) => [stream.name, operations.stream(`${name}.${stream.name}`)] as const),
		]),
		{ [LiveConnection]: automatic.subscription },
	);
}

export function makeClient<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	TStreams extends readonly StreamShape[],
	TScope extends "session" | undefined,
	TExtra extends Rpc.Any = never,
>(
	contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams, TScope>,
	options: ClientOptions & { readonly group?: RpcGroup.RpcGroup<TRpcs | TExtra> } & ("session" extends TScope
			? { readonly registry: AtomRegistry.AtomRegistry }
			: { readonly registry?: AtomRegistry.AtomRegistry }),
): MadeClient<TName, TQueries, TCommands, TRpcs, TStreams, TExtra>;
export function makeClient(
	contract: RpcSource & {
		readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>;
	},
	options: ClientOptions & {
		readonly group?: RpcSource;
		readonly registry?: AtomRegistry.AtomRegistry;
	},
): Layer.Layer<never> {
	const connection = rpcClient(contract.declaration.name, options.group ?? contract, options);
	const api = bindApi(contract, connection.Client, options);
	return Object.assign(connection, { api });
}
