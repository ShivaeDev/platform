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
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer Error, infer Middleware, infer _Requires>
		? Error["Type"] | Middleware["error"]["Type"] | RpcClientError
		: never;

export type RunFailure<R extends Rpc.Any> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer Middleware, infer _Requires>
		? Failure<R> | Middleware["~ClientError"]
		: never;

export interface QueryOptions {
	readonly headers?: Headers.Input;
	readonly timeToLive?: Duration.Input;
	readonly serializationKey?: string;
}

export interface BoundQuery<R extends Rpc.Any, Self> {
	readonly query: (payload: Rpc.Payload<R>, options?: QueryOptions) => Atom.Atom<AsyncResult.AsyncResult<Rpc.Success<R>, Failure<R>>>;
	readonly run: (payload: Rpc.Payload<R>) => Effect.Effect<Rpc.Success<R>, RunFailure<R>, Self>;
}

export interface BoundCommand<R extends Rpc.Any, Self> {
	readonly run: (payload: Rpc.Payload<R>) => Effect.Effect<Rpc.Success<R>, RunFailure<R>, Self | Reactivity.Reactivity>;
}

export type Bound<
	Name extends string,
	Queries extends ReadonlyArray<QueryShape>,
	Commands extends ReadonlyArray<CommandShape>,
	Rpcs extends Rpc.Any,
	Self,
> = {
	readonly [Query in Queries[number] as Query["name"]]: BoundQuery<Rpc.ExtractTag<Rpcs, Tag<Name, Query["name"]>>, Self>;
} & {
	readonly [Command in Commands[number] as Command["name"]]: BoundCommand<Rpc.ExtractTag<Rpcs, Tag<Name, Command["name"]>>, Self>;
};

type ErasedClient = AtomRpc.AtomRpcClient<unknown, string, Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>>;

const invalidateAfter = Effect.fn("EffectContract.invalidate")(function* (keys: ReadonlyArray<Key>) {
	yield* Reactivity.invalidate(invalidationKeys(keys));
});

const boundQuery = (service: ErasedClient, tag: string, query: QueryShape) => {
	const reads = (payload: unknown) => readKeys(query.reads(payload));
	return {
		query: (payload: unknown, options: QueryOptions = {}) => service.query(tag, payload, { ...options, reactivityKeys: reads(payload) }),
		run: (payload: unknown) => service.use((client) => client(tag, payload)),
	};
};

const boundCommand = (service: ErasedClient, tag: string, command: CommandShape) => ({
	run: (payload: unknown) =>
		service.use((client) => client(tag, payload)).pipe(Effect.tap((result) => invalidateAfter(command.invalidates(payload, result)))),
});

export function bind<
	Name extends string,
	Queries extends ReadonlyArray<QueryShape>,
	Commands extends ReadonlyArray<CommandShape>,
	Rpcs extends Rpc.Any,
	Self,
	Id extends string,
>(contract: Contract<Name, Queries, Commands, Rpcs>, service: AtomRpc.AtomRpcClient<Self, Id, Rpcs>): Bound<Name, Queries, Commands, Rpcs, Self>;
export function bind(
	contract: { readonly declaration: Declared<string, ReadonlyArray<QueryShape>, ReadonlyArray<CommandShape>> },
	service: ErasedClient,
): unknown {
	const { name, queries, commands } = contract.declaration;
	return Object.fromEntries([
		...queries.map((query) => [query.name, boundQuery(service, `${name}.${query.name}`, query)] as const),
		...commands.map((command) => [command.name, boundCommand(service, `${name}.${command.name}`, command)] as const),
	]);
}
