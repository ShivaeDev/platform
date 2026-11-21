import { Effect, MutableRef } from "effect";
import { type Rpc, RpcGroup } from "effect/rpc";
import { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";
import { HostModels } from "#HostModels.ts";

interface SensitiveSources<TRpcs extends Rpc.Any> {
	readonly config?: { readonly sensitiveKeys?: readonly string[] };
	readonly group?: RpcGroup.RpcGroup<TRpcs>;
}

type Compile = (extra: readonly string[]) => ReturnType<typeof schemaSensitiveKeys>;

function compiler<TRpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<TRpcs> | undefined): Compile {
	return (extra) => (group === undefined ? schemaSensitiveKeys(RpcGroup.make(), extra) : schemaSensitiveKeys(group, extra));
}

export const hostSensitiveKeys = Effect.fnUntraced(function* <TRpcs extends Rpc.Any>({ config, group }: SensitiveSources<TRpcs>) {
	const configured = config?.sensitiveKeys ?? [];
	const compile = MutableRef.make(compiler(group));
	// Model names only widen masking, so the configured policy already holds the startup's conflict verdict.
	const current = MutableRef.make(yield* MutableRef.get(compile)(configured));
	const { fieldNames } = yield* HostModels;
	function sensitive(key: string) {
		return fieldNames.has(key) || MutableRef.get(current)(key);
	}
	return Object.assign(sensitive, {
		// Repositories declare their models while the host builds them, and a deferred application names its RPC group only when it returns,
		// after running inside this policy: complete and serve recompile every RPC's policy from what is known then.
		complete: Effect.suspend(() => MutableRef.get(compile)([...configured, ...fieldNames])).pipe(
			Effect.map((completed) => MutableRef.set(current, completed)),
			Effect.asVoid,
		),
		forRpc: (tag: string | undefined) => {
			const forTag = MutableRef.get(current).forRpc(tag);
			return (key: string) => fieldNames.has(key) || forTag(key);
		},
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") => MutableRef.get(current).maskFailure(tag, reason),
		redactFailure: (tag: string | undefined, reason: "Fail" | "Die", value: unknown) => MutableRef.get(current).redactFailure(tag, reason, value),
		serve: <TServed extends Rpc.Any>(served: { readonly group?: RpcGroup.RpcGroup<TServed> }) =>
			Effect.suspend(() => {
				const next = compiler(served.group);
				return Effect.map(next(configured), (compiled) => {
					MutableRef.set(compile, next);
					MutableRef.set(current, compiled);
				});
			}),
	});
});
