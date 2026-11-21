import { Effect, MutableRef } from "effect";
import { type Rpc, RpcGroup } from "effect/rpc";
import { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";
import { HostModels } from "#HostModels.ts";

export const hostSensitiveKeys = Effect.fnUntraced(function* <TRpcs extends Rpc.Any>(options: {
	readonly group?: RpcGroup.RpcGroup<TRpcs>;
	readonly config?: { readonly sensitiveKeys?: readonly string[] };
}) {
	const configured = options.config?.sensitiveKeys ?? [];
	function policy(extra: readonly string[]) {
		return options.group === undefined ? schemaSensitiveKeys(RpcGroup.make(), extra) : schemaSensitiveKeys(options.group, extra);
	}
	// Model names only widen masking, so the configured policy already holds the startup's conflict verdict.
	const current = MutableRef.make(yield* policy(configured));
	const { fieldNames } = yield* HostModels;
	function sensitive(key: string) {
		return fieldNames.has(key) || MutableRef.get(current)(key);
	}
	return Object.assign(sensitive, {
		// Repositories declare their models while the host builds them; complete recompiles every RPC's policy with their names, as config.sensitiveKeys.
		complete: Effect.suspend(() => policy([...configured, ...fieldNames])).pipe(
			Effect.map((completed) => MutableRef.set(current, completed)),
			Effect.asVoid,
		),
		forRpc: (tag: string | undefined) => {
			const forTag = MutableRef.get(current).forRpc(tag);
			return (key: string) => fieldNames.has(key) || forTag(key);
		},
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") => MutableRef.get(current).maskFailure(tag, reason),
		redactFailure: (tag: string | undefined, reason: "Fail" | "Die", value: unknown) => MutableRef.get(current).redactFailure(tag, reason, value),
	});
});
