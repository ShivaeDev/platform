import { Schema } from "effect";
import { ruleConfiguration } from "#adapters/rule.ts";
import { type Decoded, decodeWith } from "#decoded.ts";
import { ExceptionDeclaration } from "#exceptions/declaration.ts";
import type { RegisteredRule } from "#rule.ts";

function isRule(value: unknown): value is RegisteredRule {
	return (
		typeof value === "object"
		&& value !== null
		&& "id" in value
		&& typeof value.id === "string"
		&& "description" in value
		&& typeof value.description === "string"
		&& ruleConfiguration in value
		&& typeof value[ruleConfiguration] === "function"
	);
}

const Level = Schema.Literal("error");

const Setting = Schema.Union([Level, Schema.Struct({ level: Schema.optionalKey(Level), options: Schema.optionalKey(Schema.Unknown) })]);

const LocalRule = Schema.declare(isRule, { expected: "a rule made with defineRule" });

const ConfigInput = Schema.Struct({
	baseline: Schema.optionalKey(Schema.String),
	exceptions: Schema.optionalKey(Schema.Array(ExceptionDeclaration)),
	extensions: Schema.optionalKey(Schema.Array(Schema.String)),
	local: Schema.optionalKey(Schema.Array(LocalRule)),
	registry: Schema.optionalKey(Schema.String),
	rules: Schema.optionalKey(Schema.Record(Schema.String, Setting)),
	sources: Schema.optionalKey(Schema.Array(Schema.String)),
});

export type ConfigInput = typeof ConfigInput.Type;

export function decodeConfig(value: unknown): Promise<Decoded<ConfigInput>> {
	return decodeWith(ConfigInput, value);
}
