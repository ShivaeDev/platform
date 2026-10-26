import { Context } from "effect";
import { isSensitiveKey, type SensitiveKey } from "@shivaedev/errors/sensitive.ts";

export const RedactionPolicy = Context.Reference<SensitiveKey>("@shivaedev/platform/RedactionPolicy", { defaultValue: () => isSensitiveKey });
