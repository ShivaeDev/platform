import { type Rpc, RpcGroup } from "effect/rpc";
import { schemaSensitiveKeys } from "@shivaedev/errors/schemaSensitiveKeys.ts";

export function hostSensitiveKeys<TRpcs extends Rpc.Any>(options: {
	readonly group?: RpcGroup.RpcGroup<TRpcs>;
	readonly config?: { readonly sensitiveKeys?: readonly string[] };
}) {
	return options.group === undefined
		? schemaSensitiveKeys(RpcGroup.make(), options.config?.sensitiveKeys)
		: schemaSensitiveKeys(options.group, options.config?.sensitiveKeys);
}
