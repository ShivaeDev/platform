import { type Context, type Effect, Layer } from "effect";
import { Rpc, type RpcGroup, type RpcMiddleware } from "effect/rpc";
import type { SubjectDeclaration } from "#subject.ts";
import { SUBJECT_TYPE_ID } from "#subjectMiddleware.ts";

type Middleware<R extends Rpc.Any> = R extends { readonly middlewares: ReadonlySet<infer TMiddleware> }
	? Extract<TMiddleware, { readonly [SUBJECT_TYPE_ID]: SubjectDeclaration }>
	: never;

function isSubject(middleware: RpcMiddleware.AnyServiceWithProps): middleware is RpcMiddleware.AnyServiceWithProps & {
	readonly [SUBJECT_TYPE_ID]: SubjectDeclaration;
} {
	return SUBJECT_TYPE_ID in middleware;
}

export function subjectLayers<R extends Rpc.Any>(
	group: RpcGroup.RpcGroup<R>,
): Layer.Layer<Context.Service.Identifier<Middleware<R>>, never, Effect.Services<Middleware<R>[typeof SUBJECT_TYPE_ID]["middleware"]>>;
export function subjectLayers(group: RpcGroup.RpcGroup<Rpc.Any>) {
	const layers: Layer.Layer<never, never, unknown>[] = [];
	for (const rpc of group.requests.values()) {
		if (!Rpc.isRpc(rpc)) {
			continue;
		}
		const middlewares: ReadonlySet<RpcMiddleware.AnyServiceWithProps> = rpc.middlewares;
		for (const middleware of middlewares) {
			if (isSubject(middleware)) {
				layers.push(Layer.effect(middleware, middleware[SUBJECT_TYPE_ID].middleware));
			}
		}
	}
	return Layer.mergeAll(Layer.empty, ...layers);
}
