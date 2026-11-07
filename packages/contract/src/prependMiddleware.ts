import { Effect, type Schema } from "effect";
import { Rpc, RpcGroup, type RpcMiddleware, RpcSchema, type Rpc as RpcType } from "effect/rpc";

function hasNativeProps(rpc: RpcType.Any): rpc is RpcType.AnyWithProps & { readonly defectSchema: RpcType.DefectSchema } {
	return "payloadSchema" in rpc && "successSchema" in rpc && "errorSchema" in rpc && "defectSchema" in rpc && "middlewares" in rpc;
}

function rebuild(rpc: RpcType.AnyWithProps & { readonly defectSchema: RpcType.DefectSchema }, key: string): RpcType.Any {
	const stream = RpcSchema.isStreamSchema(rpc.successSchema) ? rpc.successSchema : undefined;
	let rebuilt: RpcType.Rpc<string, Schema.Top, Schema.Top, Schema.Top, RpcMiddleware.AnyService, unknown> = Rpc.make(rpc._tag, {
		defect: rpc.defectSchema,
		error: stream?.error ?? rpc.errorSchema,
		payload: rpc.payloadSchema,
		...(stream === undefined ? {} : { stream: true as const }),
		success: stream?.success ?? rpc.successSchema,
	});
	rebuilt = rebuilt.annotateMerge(rpc.annotations);
	const middlewares = [...rpc.middlewares].sort((left, right) => Number(right.key === key) - Number(left.key === key));
	for (const middleware of middlewares) {
		rebuilt = rebuilt.middleware(middleware);
	}
	return rebuilt;
}

export function prependMiddleware<R extends RpcType.Any>(group: RpcGroup.RpcGroup<R>, key: string): Effect.Effect<RpcGroup.RpcGroup<R>>;
export function prependMiddleware(group: RpcGroup.RpcGroup<RpcType.Any>, key: string): Effect.Effect<RpcGroup.RpcGroup<RpcType.Any>> {
	return Effect.sync(() => {
		// Native middleware runs in reverse order; identity must supply the viewer before this guard runs.
		const requests = [...group.requests.values()].map((rpc) => (hasNativeProps(rpc) ? rebuild(rpc, key) : rpc));
		return RpcGroup.make(...requests).annotateMerge(group.annotations);
	});
}
