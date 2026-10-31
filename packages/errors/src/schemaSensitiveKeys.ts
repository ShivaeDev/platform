import type { Schema, SchemaAST } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { collect, collectEncodedKeys, collectFieldKeys, marked, maskedValue } from "#schemaSensitiveAst.ts";
import { isSensitiveKey } from "#sensitive.ts";

function rpcSensitiveKeys(rpc: Rpc.AnyWithProps, extra: readonly string[]) {
	const keys = new Set(extra);
	const nodes = new Set<SchemaAST.AST>();
	const schemas: Schema.Top[] = [
		rpc.payloadSchema,
		rpc.successSchema,
		rpc.errorSchema,
		rpc.defectSchema,
		...[...rpc.middlewares].map((m) => m.error),
	];
	for (const schema of schemas) {
		collect(schema.ast, nodes);
	}
	const properties = [...nodes].flatMap((ast) => (ast._tag === "Objects" ? ast.propertySignatures : []));
	collectFieldKeys(properties, keys, marked);
	let previousSize: number;
	do {
		previousSize = keys.size;
		collectFieldKeys(properties, keys, (ast) => maskedValue(ast, keys));
		for (const ast of nodes) {
			collectEncodedKeys(ast, keys);
		}
	} while (keys.size !== previousSize);
	return Object.assign((key: string) => keys.has(key) || isSensitiveKey(key), {
		die: maskedValue(rpc.defectSchema.ast, keys),
		fail: [rpc.errorSchema, ...[...rpc.middlewares].map((m) => m.error)].some((schema) => maskedValue(schema.ast, keys)),
	});
}
export function schemaSensitiveKeys<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, extra: readonly string[] = []) {
	const policies = new Map<string, ReturnType<typeof rpcSensitiveKeys>>();
	for (const rpc of group.requests.values()) {
		if (Rpc.isRpc(rpc)) {
			policies.set(rpc._tag, rpcSensitiveKeys(rpc, extra));
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
}
