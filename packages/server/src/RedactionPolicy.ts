import { Context } from "effect";
import { isSensitiveKey, type SensitiveKey } from "@shivaedev/errors/sensitive.ts";

export interface HostRedactionPolicy extends SensitiveKey {
	readonly forRpc?: (tag: string | undefined) => SensitiveKey;
}
export function redactionForRpc(policy: HostRedactionPolicy, tag: unknown): SensitiveKey {
	return policy.forRpc?.(typeof tag === "string" ? tag : undefined) ?? policy;
}
export const RedactionPolicy = Context.Reference<HostRedactionPolicy>("@shivaedev/server/RedactionPolicy", { defaultValue: () => isSensitiveKey });
