import { Effect } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { schemaFieldKeys, validateFieldScope } from "#schemaFieldScope.ts";
import { maskedValue } from "#schemaSensitiveAst.ts";
import { isSensitiveKey } from "#sensitive.ts";

const rpcSensitiveKeys = Effect.fnUntraced(function* (rpc: Rpc.AnyWithProps, extra: readonly string[]) {
	const schemas = [
		{ ast: rpc.payloadSchema.ast, name: `${rpc._tag}.payload` },
		{ ast: rpc.successSchema.ast, name: `${rpc._tag}.success` },
		{ ast: rpc.errorSchema.ast, name: `${rpc._tag}.error` },
		{ ast: rpc.defectSchema.ast, name: `${rpc._tag}.defect` },
		...[...rpc.middlewares].map((middleware, index) => ({ ast: middleware.error.ast, name: `${rpc._tag}.middleware[${index}].error` })),
	];
	yield* validateFieldScope(schemas, extra);
	const keys = new Set(schemas.flatMap(({ ast }) => [...schemaFieldKeys(ast, extra)]));
	return Object.assign((key: string) => keys.has(key) || isSensitiveKey(key), {
		die: maskedValue(rpc.defectSchema.ast, keys),
		fail: [rpc.errorSchema, ...[...rpc.middlewares].map((m) => m.error)].some((schema) => maskedValue(schema.ast, keys)),
	});
});
export const schemaSensitiveKeys = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, extra: readonly string[] = []) {
	const policies = new Map<string, Effect.Success<ReturnType<typeof rpcSensitiveKeys>>>();
	for (const rpc of group.requests.values()) {
		if (Rpc.isRpc(rpc)) {
			policies.set(rpc._tag, yield* rpcSensitiveKeys(rpc, extra));
		}
	}
	function sensitive(key: string) {
		return extra.includes(key) || isSensitiveKey(key) || [...policies.values()].some((policy) => policy(key));
	}
	return Object.assign(sensitive, {
		forRpc: (tag: string | undefined) => (tag === undefined ? sensitive : (policies.get(tag) ?? sensitive)),
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") =>
			[...policies].some(([method, policy]) => (tag === undefined || tag === method) && (reason === "Fail" ? policy.fail : policy.die)),
	});
});
