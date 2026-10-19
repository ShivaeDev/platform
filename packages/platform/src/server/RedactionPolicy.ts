import { Context } from "effect";
import { isSensitiveKey, type SensitiveKey } from "#server/rpc-server/sensitive.ts";

export const RedactionPolicy = Context.Reference<SensitiveKey>("@shivaedev/platform/RedactionPolicy", { defaultValue: () => isSensitiveKey });
