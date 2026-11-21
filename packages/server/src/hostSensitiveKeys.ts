import { Effect, MutableRef } from "effect";
import { type Rpc, RpcGroup } from "effect/rpc";
import { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";
import { HostModels } from "#HostModels.ts";

interface SensitiveSources<TRpcs extends Rpc.Any> {
	readonly config?: { readonly sensitiveKeys?: readonly string[] };
	readonly group?: RpcGroup.RpcGroup<TRpcs>;
}

interface PolicySource {
	readonly compile: (extra: readonly string[]) => ReturnType<typeof schemaSensitiveKeys>;
	readonly configured: readonly string[];
}

function policySource<TRpcs extends Rpc.Any>({ config, group }: SensitiveSources<TRpcs>): PolicySource {
	return {
		compile: (extra) => (group === undefined ? schemaSensitiveKeys(RpcGroup.make(), extra) : schemaSensitiveKeys(group, extra)),
		configured: config?.sensitiveKeys ?? [],
	};
}

export const hostSensitiveKeys = Effect.fnUntraced(function* <TRpcs extends Rpc.Any>(options: SensitiveSources<TRpcs>) {
	const source = MutableRef.make(policySource(options));
	// Model names only widen masking, so the configured policy already holds the startup's conflict verdict.
	const current = MutableRef.make(yield* MutableRef.get(source).compile(MutableRef.get(source).configured));
	const { fieldNames } = yield* HostModels;
	function sensitive(key: string) {
		return fieldNames.has(key) || MutableRef.get(current)(key);
	}
	return Object.assign(sensitive, {
		// Repositories declare their models while the host builds them, and a deferred application names its RPC group and configured keys
		// only when it returns, after running inside this policy: complete and configure recompile every RPC's policy from what is known then.
		complete: Effect.suspend(() => {
			const { compile, configured } = MutableRef.get(source);
			return compile([...configured, ...fieldNames]);
		}).pipe(
			Effect.map((completed) => MutableRef.set(current, completed)),
			Effect.asVoid,
		),
		configure: <TConfigured extends Rpc.Any>(sources: SensitiveSources<TConfigured>) =>
			Effect.suspend(() => {
				const next = policySource(sources);
				return Effect.map(next.compile(next.configured), (compiled) => {
					MutableRef.set(source, next);
					MutableRef.set(current, compiled);
				});
			}),
		forRpc: (tag: string | undefined) => {
			const forTag = MutableRef.get(current).forRpc(tag);
			return (key: string) => fieldNames.has(key) || forTag(key);
		},
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") => MutableRef.get(current).maskFailure(tag, reason),
		redactFailure: (tag: string | undefined, reason: "Fail" | "Die", value: unknown) => MutableRef.get(current).redactFailure(tag, reason, value),
	});
});
