import { Effect, MutableRef } from "effect";
import { type Rpc, RpcGroup } from "effect/rpc";
import { schemaFieldKeys } from "@shivaedev/errors/schemaFieldScope.ts";
import { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";

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
	const models = new Set<string>();
	function sensitive(key: string) {
		return models.has(key) || MutableRef.get(current)(key);
	}
	return Object.assign(sensitive, {
		// Repositories declare their models while the host builds them; complete recompiles every RPC's policy with their names, as config.sensitiveKeys.
		complete: Effect.suspend(() => policy([...configured, ...models])).pipe(
			Effect.map((completed) => MutableRef.set(current, completed)),
			Effect.asVoid,
		),
		forRpc: (tag: string | undefined) => {
			const forTag = MutableRef.get(current).forRpc(tag);
			return (key: string) => models.has(key) || forTag(key);
		},
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") => MutableRef.get(current).maskFailure(tag, reason),
		models: {
			declare: (model: { readonly ast: Parameters<typeof schemaFieldKeys>[0] }) =>
				Effect.sync(() => {
					for (const key of schemaFieldKeys(model.ast, [])) {
						models.add(key);
					}
				}),
		},
		redactFailure: (tag: string | undefined, reason: "Fail" | "Die", value: unknown) => MutableRef.get(current).redactFailure(tag, reason, value),
	});
});
