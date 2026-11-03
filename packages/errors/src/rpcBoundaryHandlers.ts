import { Effect, Result, Schema, Stream, type Types } from "effect";
import { Rpc, type RpcGroup, RpcSchema } from "effect/rpc";
import { type RpcBoundaryOptions, rpcBoundary } from "#boundary.ts";

type HandlerResult = Effect.Effect<unknown, unknown, unknown> | Stream.Stream<unknown, unknown, unknown>;
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

type Rejection<TRpc extends Rpc.Any> = TRpc extends Rpc.AnyWithProps
	? TRpc["errorSchema"]["Type"] | (TRpc["successSchema"] extends RpcSchema.Stream<infer _A, infer E> ? E["Type"] : never)
	: never;

type BoundedHandlers<TRpcs extends Rpc.Any, THandlers> = {
	readonly [TKey in keyof THandlers]: THandlers[TKey] extends (...args: infer TArgs) => infer TValue
		? (...args: TArgs) => Bounded<TValue, Rejection<Extract<TRpcs, { readonly _tag: TKey }>>>
		: never;
};

type GroupOptions<TRpcs extends Rpc.Any> = Types.UnionToIntersection<TRpcs extends unknown ? RpcBoundaryOptions<Rejection<TRpcs>> : never>;

export function rpcBoundaryHandlers<TRpcs extends Rpc.Any, THandlers extends Handlers<TRpcs>>(
	group: RpcGroup.RpcGroup<TRpcs>,
	options: NoInfer<GroupOptions<TRpcs>>,
	handlers: THandlers,
): BoundedHandlers<TRpcs, THandlers>;
export function rpcBoundaryHandlers<TTag extends string>(
	group: RpcGroup.RpcGroup<Rpc.AnyWithProps & { readonly _tag: TTag }>,
	options: RpcBoundaryOptions<unknown>,
	handlers: Readonly<Record<TTag, (...args: never[]) => Rpc.WrapperOr<HandlerResult>>>,
) {
	return Object.fromEntries(
		Array.from(group.requests.values(), (rpc) => {
			const tag = rpc._tag;
			const handler = handlers[tag];
			const streaming = RpcSchema.isStreamSchema(rpc.successSchema);
			const schema = RpcSchema.isStreamSchema(rpc.successSchema) ? Schema.Union([rpc.errorSchema, rpc.successSchema.error]) : rpc.errorSchema;
			const boundary = rpcBoundary(schema, options);
			return [
				tag,
				(...args: never[]) => {
					const constructed = Result.try(() => handler(...args));
					if (Result.isFailure(constructed)) {
						const failure = boundary(Effect.die(constructed.failure));
						return streaming ? Stream.fromEffect(failure) : failure;
					}
					return Rpc.wrapMap(constructed.success, (result) =>
						Effect.isEffect(result) ? boundary(result) : Stream.catchCause(result, (cause) => Stream.fromEffect(boundary(Effect.failCause(cause)))),
					);
				},
			];
		}),
	);
}
