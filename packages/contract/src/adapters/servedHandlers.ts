import { Context, Effect, Layer, Option } from "effect";
import { Rpc } from "effect/rpc";
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
function servedPolicy(rpc: Rpc.AnyWithProps, query: QueryShape): QueryReadPolicy<unknown, unknown, unknown> {
	const boundary = guarded(rpc);
	return (payload, viewer) => boundary(Effect.suspend(() => query.readPolicy(payload, viewer)));
}

// RpcGroup.toLayerHandler cannot type-check a handler against an erased Rpc, whose `any` success schema selects the stream
// branch of Rpc.ResultFrom, so the entry is built the way toLayerHandler builds it, capturing the Layer's context.
function handlerLayer(rpc: Rpc.Any, handler: Runnable) {
	return Layer.effectContext(
		Effect.map(Effect.context<never>(), (context) => Context.makeUnsafe<Rpc.Handler<string>>(new Map([[rpc.key, { context, handler }]]))),
	);
}

export function servedHandlers(
	application: { readonly requests: ReadonlyMap<string, Rpc.Any> },
	declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>,
): Layer.Layer<Rpc.Handler<string>, never, unknown> {
	const layers = [...declaration.queries, ...declaration.commands].map((operation): Layer.Layer<Rpc.Handler<string>, never, unknown> => {
		const tag = `${declaration.name}.${operation.name}`;
		const rpc = Option.fromNullishOr(application.requests.get(tag)).pipe(Option.filter(Rpc.isRpc));
		const run = runOf(operation);
		if (Option.isNone(rpc) || run === undefined) {
			return Layer.effectContext(Effect.die(new Error(`Module ${declaration.name} cannot serve ${tag}: it has no RPC or no run`)));
		}
		const handler = handlerLayer(rpc.value, served(rpc.value, operation, run, `${spanOwner(declaration.name)}.${operation.name}`));
		return operation.kind === "query" ? handler.pipe(Layer.provide(Layer.succeed(ServedReadPolicy, servedPolicy(rpc.value, operation)))) : handler;
	});
	return Layer.mergeAll(Layer.empty, ...layers);
}
