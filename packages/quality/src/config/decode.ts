import { Schema } from "effect";
import { type Decoded, decodeWith } from "../decoded.ts";
import type { Rule } from "../rule.ts";

const isRule = (value: unknown): value is Rule =>
	typeof value === "object"
	&& value !== null
	&& "id" in value
	&& typeof value.id === "string"
	&& "description" in value
	&& typeof value.description === "string"
	&& "configure" in value
	&& typeof value.configure === "function";

const Level = Schema.Literals(["error", "warn", "off"]);

const Setting = Schema.Union([Level, Schema.Struct({ level: Schema.optionalKey(Level), options: Schema.optionalKey(Schema.Unknown) })]);

const LocalRule = Schema.declare(isRule, { expected: "a rule made with defineRule" });

const ConfigInput = Schema.Struct({
	adopt: Schema.optionalKey(Schema.Array(Schema.String)),
	baseline: Schema.optionalKey(Schema.String),
	exclude: Schema.optionalKey(Schema.Array(Schema.String)),
	extensions: Schema.optionalKey(Schema.Array(Schema.String)),
	local: Schema.optionalKey(Schema.Array(LocalRule)),
	registry: Schema.optionalKey(Schema.String),
	rules: Schema.optionalKey(Schema.Record(Schema.String, Setting)),
	sources: Schema.optionalKey(Schema.Array(Schema.String)),
});

export type ConfigInput = typeof ConfigInput.Type;

const standard = Schema.toStandardSchemaV1(ConfigInput, { parseOptions: { errors: "all", onExcessProperty: "error" } });

export const decodeConfig = (value: unknown): Promise<Decoded<ConfigInput>> => decodeWith(standard, value);
