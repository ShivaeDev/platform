import { type Result, Schema } from "effect";
import { jsonDecoder } from "#lint/adapters/json.ts";

export const REGISTRY_FILE = "script/pragma-registry.json";

const RegistryEntry = Schema.Struct({
	file: Schema.String,
	pragma: Schema.String,
	reason: Schema.NonEmptyString,
});
export type RegistryEntry = typeof RegistryEntry.Type;

const decode = jsonDecoder(Schema.Array(RegistryEntry));

export const decodeRegistry = (raw: string): Result.Result<readonly RegistryEntry[], Schema.SchemaError> =>
	decode(raw, { onExcessProperty: "error" });
