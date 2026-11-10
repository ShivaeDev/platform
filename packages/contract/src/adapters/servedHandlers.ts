import { Effect, Layer, type Schema } from "effect";
import { Rpc, RpcGroup, RpcSchema } from "effect/rpc";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { Declared } from "#contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import { CurrentViewer, checkPolicy, type QueryReadPolicy } from "#readPolicy.ts";
import { ServedReadPolicy } from "#servedReadPolicy.ts";

type Runnable = (payload: unknown) => Effect.Effect<unknown, unknown, unknown>;

function runOf(operation: QueryShape | CommandShape): Runnable | undefined {
	const run: unknown = Reflect.get(operation, "run");
	return typeof run === "function" ? (payload) => Reflect.apply(run, operation, [payload]) : undefined;
}

function spanOwner(name: string) {
	return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function guarded(rpc: Rpc.AnyWithProps) {
	return rpcBoundary(rpc.errorSchema, { unexpected: (message) => new InternalServerError({ message }) });
}

function served(rpc: Rpc.AnyWithProps, operation: QueryShape | CommandShape, run: Runnable, span: string) {
	const boundary = guarded(rpc);
	return (payload: unknown) =>
		Effect.gen(function* () {
			if (operation.kind === "query") {
				yield* checkPolicy(operation, operation.readPolicy, payload, yield* CurrentViewer);
			}
			return yield* run(payload);
		}).pipe(Effect.withSpan(span), boundary);
}

// Live subscriptions check the policy outside the handler, so the policy carries the handler's failure mapping.
function servedPolicy(rpc: Rpc.AnyWithProps, policy: QueryReadPolicy<unknown, unknown, unknown>): QueryReadPolicy<unknown, unknown, unknown> {
	const boundary = guarded(rpc);
	return (payload, viewer) => boundary(Effect.suspend(() => policy(payload, viewer)));
}

type EffectRpc = Rpc.Rpc<string, Schema.Top, Schema.Top, Schema.Top>;

// An erased Rpc's `any` success schema selects the stream branch of Rpc.ResultFrom, which an Effect handler cannot satisfy.
function isEffectRpc(rpc: Rpc.Any | undefined): rpc is EffectRpc {
	return Rpc.isRpc(rpc) && !RpcSchema.isStreamSchema(rpc.successSchema);
}

export function servedHandlers(
	application: { readonly requests: ReadonlyMap<string, Rpc.Any> },
	declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>,
): Layer.Layer<Rpc.Handler<string>, never, unknown> {
	const layers = [...declaration.queries, ...declaration.commands].map((operation): Layer.Layer<Rpc.Handler<string>, never, unknown> => {
		const tag = `${declaration.name}.${operation.name}`;
		const rpc = application.requests.get(tag);
		const run = runOf(operation);
		if (!isEffectRpc(rpc) || run === undefined) {
			return Layer.effectContext(Effect.die(new Error(`Module ${declaration.name} cannot serve ${tag}: it has no RPC or no run`)));
		}
		const handler = RpcGroup.make(rpc).toLayerHandler(tag, served(rpc, operation, run, `${spanOwner(declaration.name)}.${operation.name}`));
		return operation.kind === "query" && operation.readPolicy !== undefined
			? handler.pipe(Layer.provide(Layer.succeed(ServedReadPolicy, { check: servedPolicy(rpc, operation.readPolicy) })))
			: handler;
	});
	return Layer.mergeAll(Layer.empty, ...layers);
}
