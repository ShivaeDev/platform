import { Effect, Schema } from "effect";
import type { StandardSchemaV1 } from "#adapters/standardSchema.ts";
import { defineRule } from "#rule.ts";

export const todo = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) =>
			file.lines.flatMap((text, index) => (text.includes("TODO") ? [{ file: file.path, line: index + 1, message: "Resolve this TODO." }] : [])),
		),
	description: "Resolve TODOs before merging.",
	id: "local/no-todo",
});

const Limit = Schema.Struct({ max: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))) });

export const maxFiles = defineRule({
	check: async ({ files, options }) => (files.length > options.max ? [{ file: ".", message: `${files.length} files exceed ${options.max}.` }] : []),
	description: "Keep the repository small.",
	id: "local/max-files",
	options: Schema.toStandardSchemaV1(Limit, { parseOptions: { onExcessProperty: "error" } }),
});

const shouting: StandardSchemaV1<{ readonly word: string }, { readonly word: string }> = {
	"~standard": {
		validate: (value) =>
			typeof value === "object" && value !== null && "word" in value && typeof value.word === "string"
				? { value: { word: value.word.toUpperCase() } }
				: { issues: [{ message: "needs a word", path: [{ key: "word" }] }] },
		vendor: "test",
		version: 1,
	},
};

export const echo = defineRule({
	check: ({ options }) => [{ file: "echo", message: options.word }],
	description: "Reports its option.",
	id: "local/echo",
	options: shouting,
});

export const definedRules = [todo, maxFiles, echo];
