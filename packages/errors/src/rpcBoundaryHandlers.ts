import { Effect, Stream } from "effect";
import { Rpc, type RpcGroup, type RpcSchema } from "effect/rpc";

type Result = Effect.Effect<unknown, unknown, unknown> | Stream.Stream<unknown, unknown, unknown>;
type Handlers<R extends Rpc.Any> = {
	readonly [TRpc in R as TRpc["_tag"]]: (
		...args: Parameters<Rpc.ToHandlerFn<TRpc>>
	) => Rpc.WrapperOr<
		TRpc extends { readonly successSchema: RpcSchema.Stream<infer TSuccess, infer _E> }
			? Stream.Stream<TSuccess["Type"], unknown, unknown>
			: Effect.Effect<Rpc.Success<TRpc>, unknown, unknown>
	>;
};

type Bounded<T, E> =
	T extends Effect.Effect<infer A, infer _E, infer R>
		? Effect.Effect<A, E, R>
		: T extends Stream.Stream<infer A, infer _E, infer R>
			? Stream.Stream<A, E, R>
			: T extends Rpc.Wrapper<infer TValue>
				? Rpc.Wrapper<Bounded<TValue, E>>
				: never;

type BoundedHandlers<THandlers, E> = {
	readonly [TKey in keyof THandlers]: THandlers[TKey] extends (...args: infer TArgs) => infer TValue ? (...args: TArgs) => Bounded<TValue, E> : never;
};

export function rpcBoundaryHandlers<TRpcs extends Rpc.Any, E, THandlers extends Handlers<TRpcs>>(
	group: RpcGroup.RpcGroup<TRpcs>,
	boundary: <A, TError, R>(effect: Effect.Effect<A, TError, R>) => Effect.Effect<A, E, R>,
	handlers: THandlers,
): BoundedHandlers<THandlers, E>;
export function rpcBoundaryHandlers(
	_group: RpcGroup.RpcGroup<Rpc.Any>,
	boundary: <A, TError, R>(effect: Effect.Effect<A, TError, R>) => Effect.Effect<A, unknown, R>,
	handlers: Readonly<Record<string, (...args: never[]) => Rpc.WrapperOr<Result>>>,
) {
	return Object.fromEntries(
		Object.entries<(...args: never[]) => Rpc.WrapperOr<Result>>(handlers).map(([tag, handler]) => [
			tag,
			(...args: never[]) =>
				Rpc.wrapMap(handler(...args), (result) =>
					Effect.isEffect(result) ? boundary(result) : Stream.catchCause(result, (cause) => Stream.fromEffect(boundary(Effect.failCause(cause)))),
				),
		]),
	);
}
