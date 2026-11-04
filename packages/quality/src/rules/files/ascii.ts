import { Effect, Schema } from "effect";
import { asciiFindings } from "#adapters/asciiFindings.ts";
import { defineRule } from "#rule.ts";

const AsciiOptions = Schema.Struct({
	files: Schema.Array(Schema.NonEmptyString).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const ascii = defineRule({
	check: asciiFindings,
	description: "Chosen text files contain only ASCII characters. No files are selected by default.",
	id: "files/ascii",
	options: Schema.toStandardSchemaV1(AsciiOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
