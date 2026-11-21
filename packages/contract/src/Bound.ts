import type { Effect, Stream } from "effect";
import type { Headers } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import type { Tag } from "#operationRpc.ts";

// Like Effect's own `Rpc` helpers, these take any type: `Rpc.ExtractTag` of a generic group is not provably an `Rpc.Any`.
export type Failure<R> =
	R extends Rpc.Rpc<infer _Tag, infer _Payload, infer _Success, infer _Error, infer TMiddleware, infer _Requires>
		? Rpc.ErrorExit<R> | TMiddleware["error"]["Type"] | TMiddleware["~ClientError"] | RpcClientError
		: never;

export type RunFailure<R> = Failure<R>;

export interface RunOptions {
	readonly subject?: string;
}

export interface QueryOptions extends RunOptions {
	readonly headers?: Headers.Input;
	readonly serializationKey?: string;
}

// `runtime.fn(api.save.run)` and the React action hooks call `run` with the atom's function context second, which selects no subject.
type Run<TPayload, TResult> = (payload: TPayload, options?: RunOptions | Atom.FnContext) => TResult;

type DeclaredPayload<R> = R extends { readonly payloadSchema: infer TPayload } ? TPayload : never;

export interface BoundQuery<R, TSelf, TSubscription = never> {
	readonly query: (payload: Rpc.Payload<R>, options?: QueryOptions) => Atom.Atom<AsyncResult.AsyncResult<Rpc.Success<R>, Failure<R | TSubscription>>>;
	readonly run: Run<Rpc.Payload<R>, Effect.Effect<Rpc.Success<R>, RunFailure<R>, TSelf>>;
	readonly runtime: Atom.AtomRuntime<TSelf>;
}

export interface BoundCommand<R, TSelf> {
	readonly payload: DeclaredPayload<R>;
	readonly run: Run<Rpc.Payload<R>, Effect.Effect<Rpc.Success<R>, RunFailure<R>, TSelf | Reactivity.Reactivity>>;
	readonly runtime: Atom.AtomRuntime<TSelf>;
}

export interface BoundStream<R, TSelf> {
	readonly run: Run<Rpc.Payload<R>, Stream.Stream<Rpc.SuccessChunk<R>, RunFailure<R>, TSelf | Rpc.ServicesClient<R>>>;
	readonly runtime: Atom.AtomRuntime<TSelf>;
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
