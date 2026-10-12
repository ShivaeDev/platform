import { Effect, Schema } from "effect";
import { checkFences } from "#imports/fences/check.ts";
import { Declarations } from "#imports/fences/declarations.ts";
import { defineRule } from "#rule.ts";

const FencesOptions = Schema.Struct({
	fences: Declarations.pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const importFences = defineRule({
	check: ({ options, ...inputs }) => checkFences(inputs, options.fences),
	description:
		"Imports of shipped code respect the fences the repository declares; a test file ships nowhere, so no fence holds it. Move the code to the side of the fence its imports belong to.",
	id: "imports/fences",
	options: Schema.toStandardSchemaV1(FencesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
