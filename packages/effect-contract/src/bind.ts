import type { Duration, Schema } from "effect";
import { Effect } from "effect";
import type { Headers } from "effect/unstable/http";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { Rpc } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type { Contract, Declared, Tag } from "./contract.ts";
import { invalidationKeys, type Key, readKeys } from "./keys.ts";
import type { CommandShape, QueryShape } from "./operation.ts";

export type Failure<R extends Rpc.Any> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer TError, infer TMiddleware, infer _Requires>
		? TError["Type"] | TMiddleware["error"]["Type"] | RpcClientError
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

export type Bound<
	TName extends string,
	TQueries extends readonly QueryShape[],
	TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	TSelf,
> = {
	readonly [TQuery in TQueries[number] as TQuery["name"]]: BoundQuery<Rpc.ExtractTag<TRpcs, Tag<TName, TQuery["name"]>>, TSelf>;
} & {
	readonly [TCommand in TCommands[number] as TCommand["name"]]: BoundCommand<Rpc.ExtractTag<TRpcs, Tag<TName, TCommand["name"]>>, TSelf>;
};

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

type MatchingClient<TRpcs extends Rpc.Any, TClientRpcs extends Rpc.Any> = [TRpcs] extends [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>]
	? [Extract<TClientRpcs, { readonly _tag: TRpcs["_tag"] }>] extends [TRpcs]
		? unknown
		: "Client must preserve the contract RPC types"
	: "Client must implement the contract RPCs";

const invalidateAfter = Effect.fn("EffectContract.invalidateAfter")(function* (keys: readonly Key[]) {
	yield* Reactivity.invalidate(invalidationKeys(keys));
});

function boundQuery(service: ErasedClient, tag: string, query: QueryShape) {
	function reads(payload: unknown) {
		return readKeys(query.reads(payload));
	}
	return {
		query: (payload: unknown, options: QueryOptions = {}) => service.query(tag, payload, { ...options, reactivityKeys: reads(payload) }),
		run: (payload: unknown) => service.use((client) => client(tag, payload)),
	};
}

function boundCommand(service: ErasedClient, tag: string, command: CommandShape) {
	return {
		run: (payload: unknown) =>
			service.use((client) => client(tag, payload)).pipe(Effect.tap((result) => invalidateAfter(command.invalidates(payload, result)))),
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
>(
	contract: Contract<TName, TQueries, TCommands, TRpcs>,
	service: AtomRpc.AtomRpcClient<TSelf, TId, TClientRpcs> & MatchingClient<NoInfer<TRpcs>, TClientRpcs>,
): Bound<TName, TQueries, TCommands, TRpcs, TSelf>;
export function bind(
	contract: { readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[]> },
	service: ErasedClient,
): unknown {
	const { name, queries, commands } = contract.declaration;
	return Object.fromEntries([
		...queries.map((query) => [query.name, boundQuery(service, `${name}.${query.name}`, query)] as const),
		...commands.map((command) => [command.name, boundCommand(service, `${name}.${command.name}`, command)] as const),
	]);
}
