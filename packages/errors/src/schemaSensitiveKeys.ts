import { Effect } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { SensitiveFieldConflict, schemaFieldKeys, validateFieldScope } from "#schemaFieldScope.ts";
import { maskedValue } from "#schemaSensitiveAst.ts";
import { isSensitiveKey, REDACTED } from "#sensitive.ts";
import { wireRedactor } from "#wireRedactor.ts";

const rpcSensitiveKeys = Effect.fnUntraced(function* (rpc: Rpc.AnyWithProps, extra: readonly string[]) {
	const Errors = Rpc.exitSchema(rpc).error;
	const schemas = [
		{ ast: rpc.payloadSchema.ast, name: `${rpc._tag}.payload` },
		{ ast: rpc.successSchema.ast, name: `${rpc._tag}.success` },
		{ ast: rpc.errorSchema.ast, name: `${rpc._tag}.error` },
		{ ast: rpc.defectSchema.ast, name: `${rpc._tag}.defect` },
		...[...rpc.middlewares].map((middleware, index) => ({ ast: middleware.error.ast, name: `${rpc._tag}.middleware[${index}].error` })),
		{ ast: Errors.ast, name: `${rpc._tag}.exit.error` },
	];
	yield* validateFieldScope(schemas, extra);
	const keys = new Set(schemas.flatMap(({ ast }) => [...schemaFieldKeys(ast, extra)]));
	function sensitive(key: string) {
		return keys.has(key) || isSensitiveKey(key);
	}
	const fail = yield* wireRedactor(Errors.ast, `${rpc._tag}.error`, sensitive, keys);
	const die = yield* wireRedactor(rpc.defectSchema.ast, `${rpc._tag}.defect`, sensitive, keys);
	return Object.assign(sensitive, {
		die: maskedValue(rpc.defectSchema.ast, keys),
		fail: maskedValue(Errors.ast, keys),
		redactFailure: (reason: "Fail" | "Die", value: unknown) => (reason === "Fail" ? fail(value) : die(value)),
	});
});
export const schemaSensitiveKeys = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, extra: readonly string[] = []) {
	const policies = new Map<string, Effect.Success<ReturnType<typeof rpcSensitiveKeys>>>();
	const conflicts: SensitiveFieldConflict["conflicts"][number][] = [];
	for (const rpc of group.requests.values()) {
		if (Rpc.isRpc(rpc)) {
			const policy = yield* rpcSensitiveKeys(rpc, extra).pipe(
				Effect.catchTag("SensitiveFieldConflict", (error) => {
					conflicts.push(...error.conflicts);
					return Effect.void;
				}),
			);
			if (policy !== undefined) {
				policies.set(rpc._tag, policy);
			}
		}
	}
	if (conflicts.length > 0) {
		return yield* new SensitiveFieldConflict({ conflicts });
	}
	function sensitive(key: string) {
		return extra.includes(key) || isSensitiveKey(key) || [...policies.values()].some((policy) => policy(key));
	}
	return Object.assign(sensitive, {
		forRpc: (tag: string | undefined) => (tag === undefined ? sensitive : (policies.get(tag) ?? sensitive)),
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") =>
			[...policies].some(([method, policy]) => (tag === undefined || tag === method) && (reason === "Fail" ? policy.fail : policy.die)),
		redactFailure: (tag: string | undefined, reason: "Fail" | "Die", value: unknown) => {
			const policy = policies.get(tag ?? "");
			return policy === undefined ? REDACTED : policy.redactFailure(reason, value);
		},
	});
});
