import type { Schema } from "effect";
import { Rpc, RpcGroup, type RpcMiddleware, RpcSchema, type Rpc as RpcType } from "effect/rpc";
import { RequestTracing } from "@shivaedev/identity/middleware.ts";

function hasNativeProps(rpc: RpcType.Any): rpc is RpcType.AnyWithProps & { readonly defectSchema: RpcType.DefectSchema } {
	return "payloadSchema" in rpc && "successSchema" in rpc && "errorSchema" in rpc && "defectSchema" in rpc && "middlewares" in rpc;
}

function rebuild(rpc: RpcType.AnyWithProps & { readonly defectSchema: RpcType.DefectSchema }): RpcType.Any {
	const stream = RpcSchema.isStreamSchema(rpc.successSchema) ? rpc.successSchema : undefined;
	let rebuilt: RpcType.Rpc<string, Schema.Top, Schema.Top, Schema.Top, RpcMiddleware.AnyService, unknown> = Rpc.make(rpc._tag, {
		defect: rpc.defectSchema,
		error: stream?.error ?? rpc.errorSchema,
		payload: rpc.payloadSchema,
		...(stream === undefined ? {} : { stream: true as const }),
		success: stream?.success ?? rpc.successSchema,
	});
	rebuilt = rebuilt.annotateMerge(rpc.annotations);
	for (const middleware of rpc.middlewares) {
		if (middleware.key !== RequestTracing.key) {
			rebuilt = rebuilt.middleware(middleware);
		}
	}
	return rebuilt.middleware(RequestTracing);
}

export function tracedGroup<R extends RpcType.Any>(group: RpcGroup.RpcGroup<R>): RpcGroup.RpcGroup<R>;
export function tracedGroup(group: RpcGroup.RpcGroup<RpcType.Any>): RpcGroup.RpcGroup<RpcType.Any> {
	const requests = [...group.requests.values()].map((rpc) => (hasNativeProps(rpc) ? rebuild(rpc) : rpc));
	return RpcGroup.make(...requests).annotateMerge(group.annotations);
}
