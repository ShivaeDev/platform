import { Effect, Layer, Schema, type Scope, Stream } from "effect";
import { Rpc, RpcGroup, RpcSchema } from "effect/rpc";
import type { QueryUpdate } from "#queryUpdate.ts";
import type { QueryReference } from "#serverMetadata.ts";

type Changes<TRpcs extends Rpc.Any> = string extends TRpcs["_tag"] ? TRpcs : Extract<TRpcs, { readonly _tag: `${string}.$changes` }>;
type Definition<TRpc extends Rpc.Any> = TRpc extends Rpc.AnyWithProps ? TRpc : Rpc.AnyWithProps;
type Payload<TRpc extends Rpc.Any> = TRpc extends Rpc.AnyWithProps ? Rpc.Payload<TRpc> : { readonly queries: readonly QueryReference[] };
type Failure<TRpc extends Rpc.Any> = TRpc extends Rpc.AnyWithProps ? Rpc.ErrorExit<TRpc> : unknown;
type Handler<TRpc extends Rpc.Any, R> = (
	payload: Payload<TRpc>,
	options: Parameters<Rpc.ToHandlerFn<TRpc>>[1],
) => Stream.Stream<QueryUpdate, Failure<TRpc>, R>;

type RuntimeHandler = (
	payload: { readonly queries: readonly QueryReference[] },
	options: Parameters<Rpc.Handler<string>["handler"]>[1],
) => Stream.Stream<QueryUpdate, unknown, unknown>;

type Services<TRpcs extends Rpc.Any, R> = {
	[TTag in TRpcs["_tag"]]: RpcGroup.HandlerServices<TRpcs, TTag, Handler<TRpcs, R>>;
}[TRpcs["_tag"]];

export function changesHandlerLayer<TRpcs extends Rpc.Any, R, TError = never, TServices = never>(
	group: RpcGroup.RpcGroup<TRpcs>,
	build: (rpc: Definition<Changes<TRpcs>>) => Handler<Changes<TRpcs>, R> | Effect.Effect<Handler<Changes<TRpcs>, R>, TError, TServices>,
): Layer.Layer<Rpc.ToHandler<Changes<TRpcs>>, TError, Exclude<TServices, Scope.Scope> | Services<Changes<TRpcs>, R>>;
export function changesHandlerLayer(
	group: RpcGroup.RpcGroup<Rpc.Any>,
	build: (rpc: Rpc.AnyWithProps) => RuntimeHandler | Effect.Effect<RuntimeHandler, unknown, unknown>,
) {
	const layers: Layer.Layer<Rpc.Handler<string>, unknown, unknown>[] = [];
	for (const rpc of group.requests.values()) {
		if (!(Rpc.isRpc(rpc) && rpc._tag.endsWith(".$changes") && RpcSchema.isStreamSchema(rpc.successSchema))) {
			continue;
		}
		const decode = Schema.decodeUnknownEffect(Schema.toType(rpc.successSchema.success));
		const handler = build(rpc);
		layers.push(
			RpcGroup.make(rpc).toLayerHandler(
				rpc._tag,
				Effect.map(
					Effect.isEffect(handler) ? handler : Effect.succeed(handler),
					(subscribe) => (payload: { readonly queries: readonly QueryReference[] }, options: Parameters<Rpc.Handler<string>["handler"]>[1]) =>
						subscribe(payload, options).pipe(Stream.mapEffect((update) => decode(update).pipe(Effect.orDie))),
				),
			),
		);
	}
	return Layer.mergeAll(Layer.empty, ...layers);
}
